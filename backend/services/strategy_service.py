"""
services/strategy_service.py — EMA50 + StochRSI Strategy Engine
Strategy: Multi-timeframe Top-Down analysis + Heikin Ashi entry confirmation
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from services.data_service import add_indicators, compute_heikin_ashi, INTERVAL_MAP
except ImportError:
    from backend.services.data_service import add_indicators, compute_heikin_ashi, INTERVAL_MAP

try:
    from services.ai_adaptive_service import get_adaptive_parameters, confirm_decision
except ImportError:
    from backend.services.ai_adaptive_service import get_adaptive_parameters, confirm_decision

try:
    from services.pca_statarb_service import get_statarb_for_single_symbol
except ImportError:
    from backend.services.pca_statarb_service import get_statarb_for_single_symbol

# ──────────────────────────────────────────────
# Default Fallback Constants
# ──────────────────────────────────────────────
OVERSOLD = 20.0
OVERBOUGHT = 80.0
MIDDLE_ZONE = (40.0, 60.0)   # StochRSI "middle" / no-trade zone
EMA_PROXIMITY_MULT = 0.8     # within 0.8×ATR of EMA = "near EMA"
SL_ATR_MULT = 1.5
TP_ATR_MULT = 3.0            # ensures min 1:2 R:R
MIN_RR = 2.0


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _fetch_df(symbol: str, period: str, interval: str) -> pd.DataFrame:
    yf_interval = INTERVAL_MAP.get(interval, interval)
    raw = yf.download(symbol, period=period, interval=yf_interval, auto_adjust=True, progress=False)
    if raw is None or raw.empty:
        return pd.DataFrame()
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    raw = raw[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df = add_indicators(raw)
    return df.dropna(subset=["EMA_50", "StochRSI_K", "StochRSI_D", "ATR"])


def _stoch_state(k: float, oversold: float = 20.0, overbought: float = 80.0) -> str:
    if k <= oversold:
        return "OVERSOLD"
    elif k >= overbought:
        return "OVERBOUGHT"
    elif MIDDLE_ZONE[0] <= k <= MIDDLE_ZONE[1]:
        return "MIDDLE"
    return "NEUTRAL"


def _k_cross_up(k_now, d_now, k_prev, d_prev) -> bool:
    return k_prev < d_prev and k_now >= d_now


def _k_cross_down(k_now, d_now, k_prev, d_prev) -> bool:
    return k_prev > d_prev and k_now <= d_now


def _near_ema(price: float, ema: float, atr: float, mult: float = 0.8) -> bool:
    return abs(price - ema) <= mult * atr


# ──────────────────────────────────────────────
# Heikin Ashi Pattern Detection
# ──────────────────────────────────────────────

def _detect_ha_pattern(df: pd.DataFrame) -> dict:
    """
    Detect Doji + Reversal pattern on Heikin Ashi candles.
    Returns pattern name and entry direction.
    """
    ha = compute_heikin_ashi(df[["Open", "High", "Low", "Close"]])
    if len(ha) < 3:
        return {"pattern": "Insufficient data", "direction": None}

    c0 = ha.iloc[-1]   # latest
    c1 = ha.iloc[-2]   # previous
    c2 = ha.iloc[-3]   # two bars ago

    ha_body_0 = abs(c0["HA_Close"] - c0["HA_Open"])
    ha_range_0 = c0["HA_High"] - c0["HA_Low"] + 1e-10
    ha_body_1 = abs(c1["HA_Close"] - c1["HA_Open"])
    ha_range_1 = c1["HA_High"] - c1["HA_Low"] + 1e-10
    ha_body_2 = abs(c2["HA_Close"] - c2["HA_Open"])

    # Doji check on c2 (small body)
    is_doji_c2 = ha_body_2 / (c2["HA_High"] - c2["HA_Low"] + 1e-10) < 0.15

    # Bullish reversal: doji at low, then large bullish body with lower wick
    lower_wick_c1 = min(c1["HA_Open"], c1["HA_Close"]) - c1["HA_Low"]
    is_bull_reversal = (
        c1["HA_Close"] > c1["HA_Open"]        # green candle
        and ha_body_1 / ha_range_1 > 0.5      # large body (>50% of range)
        and lower_wick_c1 > 0                  # has lower wick
    )

    # Bearish reversal: doji at high, then large bearish body with upper wick
    upper_wick_c1 = c1["HA_High"] - max(c1["HA_Open"], c1["HA_Close"])
    is_bear_reversal = (
        c1["HA_Close"] < c1["HA_Open"]
        and ha_body_1 / ha_range_1 > 0.5
        and upper_wick_c1 > 0
    )

    # Confirm entry on c0 (current candle in reversal direction)
    bull_entry = c0["HA_Close"] > c0["HA_Open"]
    bear_entry = c0["HA_Close"] < c0["HA_Open"]

    if is_doji_c2 and is_bull_reversal and bull_entry:
        return {"pattern": "🟢 HA Bullish Reversal (Doji → Bull → Confirm)", "direction": "BUY"}
    elif is_doji_c2 and is_bear_reversal and bear_entry:
        return {"pattern": "🔴 HA Bearish Reversal (Doji → Bear → Confirm)", "direction": "SELL"}
    elif is_bull_reversal and bull_entry:
        return {"pattern": "🟢 HA Bullish Reversal Candle", "direction": "BUY"}
    elif is_bear_reversal and bear_entry:
        return {"pattern": "🔴 HA Bearish Reversal Candle", "direction": "SELL"}
    elif is_doji_c2:
        return {"pattern": "🕯️ HA Doji (Wait for reversal candle)", "direction": None}
    else:
        if c0["HA_Close"] > c0["HA_Open"]:
            return {"pattern": "📈 HA Bullish Continuation", "direction": "BUY"}
        else:
            return {"pattern": "📉 HA Bearish Continuation", "direction": "SELL"}


# ──────────────────────────────────────────────
# Single-Timeframe Signal
# ──────────────────────────────────────────────

def analyze_single_tf(df: pd.DataFrame, adaptive: dict = None) -> dict:
    """Analyze a single timeframe and return signal components with AI adaptive thresholds."""
    if len(df) < 3:
        return {"signal": "WAIT", "stoch_state": "UNKNOWN", "stoch_k": 0, "stoch_d": 0}

    if adaptive is None:
        try:
            adaptive = get_adaptive_parameters()
        except Exception:
            adaptive = {
                "stoch_oversold": 20.0,
                "stoch_overbought": 80.0,
                "ema_proximity_mult": 0.8,
                "min_rr": 2.0,
                "sl_atr_mult": 1.5,
                "tp_atr_mult": 3.0,
            }

    oversold_th = adaptive.get("stoch_oversold", 20.0)
    overbought_th = adaptive.get("stoch_overbought", 80.0)
    ema_prox_mult = adaptive.get("ema_proximity_mult", 0.8)

    row = df.iloc[-1]
    prev = df.iloc[-2]

    price = float(row["Close"])
    ema50 = float(row["EMA_50"])
    atr = float(row["ATR"])
    k = float(row["StochRSI_K"])
    d = float(row["StochRSI_D"])
    prev_k = float(prev["StochRSI_K"])
    prev_d = float(prev["StochRSI_D"])

    stoch_state = _stoch_state(k, oversold=oversold_th, overbought=overbought_th)
    near_ema = _near_ema(price, ema50, atr, mult=ema_prox_mult)
    price_above_ema = price > ema50
    k_rising = k > prev_k
    k_falling = k < prev_k
    cross_up = _k_cross_up(k, d, prev_k, prev_d)
    cross_down = _k_cross_down(k, d, prev_k, prev_d)
    k_above_d = k > d

    # Top-up condition: double cross or crosses middle
    double_cross_bull = cross_up and prev_k < MIDDLE_ZONE[0]
    double_cross_bear = cross_down and prev_k > MIDDLE_ZONE[1]

    # ── Signal Logic ──
    signal = "WAIT"
    setup = []

    if stoch_state == "MIDDLE":
        signal = "WAIT"
        setup = ["StochRSI in middle zone (40–60) — no trade setup"]

    elif stoch_state == "OVERSOLD":
        if near_ema and price_above_ema and k_rising and cross_up:
            signal = "BUY"
            setup = [
                f"✅ Price near 50 EMA ({ema_prox_mult}x ATR support)",
                "✅ Price above 50 EMA (bullish context)",
                f"✅ StochRSI oversold (<{oversold_th:.0f}) — adaptive exhaustion",
                "✅ StochRSI %K crossed above %D (reversal)",
            ]
        elif near_ema and price_above_ema and k_rising:
            signal = "BUY_WATCH"
            setup = [
                f"🟡 Near EMA support + StochRSI oversold (<{oversold_th:.0f})",
                "⏳ Wait for K to cross above D",
            ]
        elif double_cross_bull:
            signal = "TOP_UP_BUY"
            setup = ["📈 StochRSI double cross / mid cross — Top-up opportunity"]
        else:
            signal = "WAIT"
            setup = ["StochRSI oversold but no EMA confluence — wait"]

    elif stoch_state == "OVERBOUGHT":
        if near_ema and not price_above_ema and k_falling and cross_down:
            signal = "SELL"
            setup = [
                f"✅ Price near 50 EMA ({ema_prox_mult}x ATR resistance)",
                "✅ Price below 50 EMA (bearish context)",
                f"✅ StochRSI overbought (>{overbought_th:.0f}) — adaptive exhaustion",
                "✅ StochRSI %K crossed below %D (reversal)",
            ]
        elif near_ema and not price_above_ema and k_falling:
            signal = "SELL_WATCH"
            setup = [
                f"🟡 Near EMA resistance + StochRSI overbought (>{overbought_th:.0f})",
                "⏳ Wait for K to cross below D",
            ]
        elif double_cross_bear:
            signal = "TOP_UP_SELL"
            setup = ["📉 StochRSI double cross / mid cross — Top-up short opportunity"]
        elif price_above_ema and k_falling:
            # Range-bound breakout watch
            signal = "BREAKOUT_WATCH"
            setup = [
                "⚠️ StochRSI overbought + range-bound context",
                "⏳ Wait for breakout direction confirmation",
            ]
        else:
            signal = "WAIT"
            setup = ["StochRSI overbought but no EMA confluence — wait"]

    elif stoch_state == "NEUTRAL":
        signal = "WAIT"
        setup = ["StochRSI in neutral zone — no clear setup"]

    return {
        "signal": signal,
        "stoch_state": stoch_state,
        "stoch_k": round(k, 2),
        "stoch_d": round(d, 2),
        "k_cross_up": cross_up,
        "k_cross_down": cross_down,
        "price_above_ema": price_above_ema,
        "near_ema": near_ema,
        "ema50": round(ema50, 6),
        "price": round(price, 6),
        "atr": round(atr, 6),
        "setup": setup,
    }


# ──────────────────────────────────────────────
# Multi-Timeframe Analysis
# ──────────────────────────────────────────────

MTF_CONFIG = {
    "daily": ("1y", "1d"),
    "h4":    ("60d", "4h"),
    "h1":    ("30d", "60m"),
    "m15":   ("30d", "15m"),
}


def analyze_mtf(symbol: str) -> dict:
    """Run strategy analysis across all 4 timeframes."""
    results = {}
    for tf, (period, interval) in MTF_CONFIG.items():
        try:
            df = _fetch_df(symbol, period, interval)
            if df.empty:
                results[tf] = {"signal": "NO_DATA", "stoch_state": "UNKNOWN"}
                continue
            analysis = analyze_single_tf(df)
            analysis["timeframe"] = tf
            results[tf] = analysis
        except Exception as e:
            results[tf] = {"signal": "ERROR", "error": str(e)}

    # ── Composite MTF signal ──
    daily = results.get("daily", {})
    h4 = results.get("h4", {})
    h1 = results.get("h1", {})
    m15 = results.get("m15", {})

    # Trend from Daily + 4H: StochRSI direction
    daily_bull = daily.get("stoch_k", 50) > 50 and daily.get("stoch_k", 50) > daily.get("stoch_d", 50)
    daily_bear = daily.get("stoch_k", 50) < 50 and daily.get("stoch_k", 50) < daily.get("stoch_d", 50)
    h4_bull = h4.get("stoch_k", 50) > 50 and h4.get("stoch_k", 50) > h4.get("stoch_d", 50)
    h4_bear = h4.get("stoch_k", 50) < 50 and h4.get("stoch_k", 50) < h4.get("stoch_d", 50)

    if daily_bull and h4_bull:
        overall_bias = "BULLISH"
        allowed_calls = "BUY only"
    elif daily_bear and h4_bear:
        overall_bias = "BEARISH"
        allowed_calls = "SELL only"
    else:
        overall_bias = "MIXED"
        allowed_calls = "Wait for alignment"

    results["overall"] = {
        "bias": overall_bias,
        "allowed_calls": allowed_calls,
        "daily_bias": "BULLISH" if daily_bull else "BEARISH" if daily_bear else "NEUTRAL",
        "h4_bias": "BULLISH" if h4_bull else "BEARISH" if h4_bear else "NEUTRAL",
    }
    return results


# ──────────────────────────────────────────────
# Full Strategy Analysis (for /api/strategy)
# ──────────────────────────────────────────────

def analyze_full_strategy(symbol: str, period: str, interval: str) -> dict:
    """
    Full strategy analysis for the given symbol + timeframe.
    Returns: signal, entry, SL, TP, R:R, logic, steps, markers, HA pattern, MTF summary,
    and integrated AI decision confirmation with adaptive strategy tuning.
    """
    df = _fetch_df(symbol, period, interval)
    if df.empty:
        return {"signal": "NO_DATA", "error": "No data available"}

    adaptive = get_adaptive_parameters()
    analysis = analyze_single_tf(df, adaptive=adaptive)
    signal = analysis["signal"]
    entry = analysis["price"]
    ema50 = analysis["ema50"]
    atr = analysis["atr"]

    # ── Adaptive SL / TP with enforced minimum R:R ──
    sl_mult = adaptive.get("sl_atr_mult", SL_ATR_MULT)
    tp_mult = adaptive.get("tp_atr_mult", TP_ATR_MULT)
    min_rr = adaptive.get("min_rr", MIN_RR)

    sl_dist = sl_mult * atr
    tp_dist = max(tp_mult * atr, min_rr * sl_dist)

    if "BUY" in signal:
        sl = entry - sl_dist
        tp = entry + tp_dist
    elif "SELL" in signal:
        sl = entry + sl_dist
        tp = entry - tp_dist
    else:
        sl = entry - sl_dist
        tp = entry + tp_dist

    risk = abs(entry - sl)
    reward = abs(tp - entry)
    rr = reward / risk if risk > 0 else min_rr

    # ── HA Pattern ──
    ha_pattern = _detect_ha_pattern(df)

    # ── Entry Markers (recent signals on chart) ──
    markers = _find_historical_signals(df)

    # ── Trade Steps ──
    steps = _build_trade_steps(signal, entry, sl, tp, rr, analysis, ha_pattern)

    # ── Multi-Timeframe Check & PCA Stat-Arb Confluence ──
    try:
        mtf_data = analyze_mtf(symbol)
        mtf_bias = mtf_data.get("overall", {}).get("bias", "NEUTRAL")
    except Exception:
        mtf_bias = "NEUTRAL"

    statarb_res = None
    statarb_z = None
    statarb_fair = None
    try:
        statarb_info = get_statarb_for_single_symbol(symbol)
        if statarb_info.get("success") and statarb_info.get("symbol_data"):
            statarb_res = statarb_info
            statarb_z = statarb_info["symbol_data"].get("z_score")
            statarb_fair = statarb_info["symbol_data"].get("fair_price")
    except Exception:
        pass

    ai_eval = confirm_decision(
        symbol=symbol,
        signal=signal,
        current_price=entry,
        ema50=ema50,
        stoch_k=analysis["stoch_k"],
        stoch_d=analysis["stoch_d"],
        stoch_state=analysis["stoch_state"],
        mtf_bias=mtf_bias,
        ha_pattern_name=ha_pattern.get("pattern", "None"),
        ha_direction=ha_pattern.get("direction", None),
        atr=atr,
        statarb_z=statarb_z,
        statarb_fair=statarb_fair,
    )

    return {
        "signal": signal,
        "signal_display": _signal_display(signal),
        "entry": round(entry, 6),
        "sl": round(sl, 6),
        "tp": round(tp, 6),
        "rr": round(rr, 2),
        "sl_pct": round(abs(entry - sl) / entry * 100, 3),
        "tp_pct": round(abs(tp - entry) / entry * 100, 3),
        "risk": round(risk, 6),
        "reward": round(reward, 6),
        "stoch_k": analysis["stoch_k"],
        "stoch_d": analysis["stoch_d"],
        "stoch_state": analysis["stoch_state"],
        "ema50": ema50,
        "atr": atr,
        "price_above_ema": analysis["price_above_ema"],
        "near_ema": analysis["near_ema"],
        "setup": analysis["setup"],
        "ha_pattern": ha_pattern,
        "markers": markers,
        "steps": steps,
        "ai_confirmation": ai_eval,
        "adaptive_params": adaptive,
        "statarb": statarb_res,
    }


def _signal_display(signal: str) -> dict:
    mapping = {
        "BUY":           {"label": "BUY",           "color": "#00d4a8", "emoji": "▲"},
        "SELL":          {"label": "SELL",          "color": "#ff3d57", "emoji": "▼"},
        "BUY_WATCH":     {"label": "WATCH BUY",     "color": "#f59e0b", "emoji": "◎"},
        "SELL_WATCH":    {"label": "WATCH SELL",    "color": "#f59e0b", "emoji": "◎"},
        "TOP_UP_BUY":    {"label": "TOP UP ↑",      "color": "#34d399", "emoji": "⬆"},
        "TOP_UP_SELL":   {"label": "TOP UP ↓",      "color": "#f87171", "emoji": "⬇"},
        "BREAKOUT_WATCH":{"label": "BREAKOUT",      "color": "#818cf8", "emoji": "◈"},
        "WAIT":          {"label": "WAIT",          "color": "#6b7280", "emoji": "—"},
    }
    return mapping.get(signal, {"label": signal, "color": "#6b7280", "emoji": "?"})


def _find_historical_signals(df: pd.DataFrame, lookback: int = 100) -> list:
    """Find the last N signal points on the chart for marker plotting."""
    markers = []
    sub = df.tail(lookback).copy()

    for i in range(2, len(sub)):
        row = sub.iloc[i]
        prev = sub.iloc[i - 1]
        ts = int(pd.Timestamp(sub.index[i]).timestamp())

        k = float(row["StochRSI_K"])
        d = float(row["StochRSI_D"])
        pk = float(prev["StochRSI_K"])
        pd_ = float(prev["StochRSI_D"])
        price = float(row["Close"])
        ema50 = float(row["EMA_50"])
        atr = float(row["ATR"])

        if (
            k <= OVERSOLD and pk < pd_ and k >= d
            and abs(price - ema50) <= EMA_PROXIMITY_MULT * atr
            and price > ema50
        ):
            markers.append({"time": ts, "type": "BUY", "price": round(price, 6)})

        elif (
            k >= OVERBOUGHT and pk > pd_ and k <= d
            and abs(price - ema50) <= EMA_PROXIMITY_MULT * atr
            and price < ema50
        ):
            markers.append({"time": ts, "type": "SELL", "price": round(price, 6)})

    return markers[-20:]  # last 20 signals


def _build_trade_steps(signal, entry, sl, tp, rr, analysis, ha_pattern) -> list[str]:
    direction = "LONG" if "BUY" in signal else "SHORT" if "SELL" in signal else "WAIT"
    return [
        f"Step 1 — DAILY + 4H TREND: Verify StochRSI direction on higher timeframes. Only trade in trend direction.",
        f"Step 2 — 1H CONFIRMATION: Confirm StochRSI {'oversold+rising' if 'BUY' in signal else 'overbought+falling'} on 1H.",
        f"Step 3 — 15M EARLY ENTRY: Watch price action near EMA50 on 15m for precise entry.",
        f"Step 4 — HA CONFIRMATION: {ha_pattern.get('pattern', 'Watch for Doji → Reversal candle sequence')}.",
        f"Step 5 — ENTRY: Place {direction} order at {entry:.5f} on next candle open after HA reversal.",
        f"Step 6 — STOP LOSS: Set SL at {sl:.5f} ({analysis['atr']*SL_ATR_MULT:.5f} = 1.5×ATR below entry).",
        f"Step 7 — TAKE PROFIT: Set TP at {tp:.5f} (R:R = 1:{rr:.1f} ✅ Min 1:2 enforced).",
        f"Step 8 — POSITION SIZE: Risk ≤1–2% of account per trade.",
        f"Step 9 — TOP-UP: If StochRSI gives double cross or crosses mid (50), add to position.",
        f"Step 10 — INVALIDATION: Exit early if price closes beyond EMA50 against trade direction.",
    ]
