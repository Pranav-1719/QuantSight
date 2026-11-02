"""
trade_logic.py — Trade Call Generator & Logic Explainer
Computes SL/TP with ATR-based sizing, enforces minimum 1:2 R:R.
Also generates human-readable trade logic steps from indicator values.
"""

import pandas as pd

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
MIN_RR: float = 2.0       # Minimum risk-reward ratio (1:2)
SL_ATR_MULT: float = 1.5  # SL = Entry ± (1.5 × ATR)
TP_ATR_MULT: float = 3.0  # TP = Entry ± (3.0 × ATR)  →  R:R = 3/1.5 = 2.0 ✅


# ──────────────────────────────────────────────
# Trade Call Computation
# ──────────────────────────────────────────────
def compute_trade_call(df: pd.DataFrame, signal: str, atr: float) -> dict:
    """
    Returns entry, SL, TP, risk, reward, R:R for the latest bar.
    Enforces minimum 1:2 R:R by expanding TP if needed.
    """
    row = df.dropna().iloc[-1]
    entry = float(row["Close"])

    sl_distance = SL_ATR_MULT * atr
    tp_distance = max(TP_ATR_MULT * atr, MIN_RR * sl_distance)  # enforce 1:2 minimum

    if signal == "BUY":
        sl = entry - sl_distance
        tp = entry + tp_distance
    elif signal == "SELL":
        sl = entry + sl_distance
        tp = entry - tp_distance
    else:
        # HOLD — still show potential levels as reference
        sl = entry - sl_distance
        tp = entry + tp_distance

    risk = abs(entry - sl)
    reward = abs(tp - entry)
    rr = reward / risk if risk > 0 else MIN_RR

    sl_pct = risk / entry * 100
    tp_pct = reward / entry * 100

    return {
        "entry": round(entry, 5),
        "sl": round(sl, 5),
        "tp": round(tp, 5),
        "risk": round(risk, 5),
        "reward": round(reward, 5),
        "rr": round(rr, 2),
        "sl_pct": round(sl_pct, 3),
        "tp_pct": round(tp_pct, 3),
    }


# ──────────────────────────────────────────────
# Trade Steps — step-by-step trade guidance
# ──────────────────────────────────────────────
def get_trade_steps(df: pd.DataFrame, signal: str, trade: dict) -> list[str]:
    """Returns ordered list of trade execution steps for the UI."""
    direction = "long (buy)" if signal == "BUY" else "short (sell)" if signal == "SELL" else "wait"
    steps = [
        f"**Step 1 — Confirm Signal:** Model says **{signal}**. Verify on higher timeframe before entering.",
        f"**Step 2 — Entry:** Place a {direction} order near **{trade['entry']}**.",
        f"**Step 3 — Set Stop Loss:** Place SL at **{trade['sl']}** "
        f"({trade['sl_pct']:.2f}% from entry — {1.5} × ATR).",
        f"**Step 4 — Set Take Profit:** Set TP at **{trade['tp']}** "
        f"({trade['tp_pct']:.2f}% from entry — R:R = 1:{trade['rr']:.1f}).",
        "**Step 5 — Position Size:** Risk no more than 1–2% of account capital on this trade.",
        "**Step 6 — Monitor:** Watch RSI and MACD for divergence signals. Exit early if invalidated.",
        "**Step 7 — News Check:** Review the news feed below for any high-impact events before entry.",
    ]
    return steps


# ──────────────────────────────────────────────
# Trade Logic Reasons (indicator-based)
# ──────────────────────────────────────────────
def get_trade_logic(df: pd.DataFrame, signal: str) -> list[str]:
    """Returns a list of indicator-based reasons supporting the signal."""
    row = df.dropna().iloc[-1]
    prev = df.dropna().iloc[-2] if len(df.dropna()) >= 2 else row
    reasons: list[str] = []

    # ── Trend ──
    close = float(row["Close"])
    ma10 = float(row.get("MA_10", close))
    ma50 = float(row.get("MA_50", close))
    ema21 = float(row.get("EMA_21", close))

    if close > ma50:
        reasons.append(f"✅ Price **{close:.4f}** is above **MA50 ({ma50:.4f})** → Bullish trend")
    else:
        reasons.append(f"🔴 Price **{close:.4f}** is below **MA50 ({ma50:.4f})** → Bearish trend")

    if ma10 > ma50:
        reasons.append(f"✅ **MA10 ({ma10:.4f}) > MA50 ({ma50:.4f})** → Golden cross / bullish bias")
    else:
        reasons.append(f"🔴 **MA10 ({ma10:.4f}) < MA50 ({ma50:.4f})** → Death cross / bearish bias")

    if close > ema21:
        reasons.append(f"✅ Price above **EMA21 ({ema21:.4f})** → Short-term bullish")
    else:
        reasons.append(f"🔴 Price below **EMA21 ({ema21:.4f})** → Short-term bearish")

    # ── RSI ──
    rsi = float(row.get("RSI", 50))
    if rsi > 70:
        reasons.append(f"⚠️ **RSI = {rsi:.1f}** → Overbought (>70) — potential reversal risk")
    elif rsi < 30:
        reasons.append(f"⚠️ **RSI = {rsi:.1f}** → Oversold (<30) — potential bounce")
    elif rsi > 55:
        reasons.append(f"✅ **RSI = {rsi:.1f}** → Bullish momentum zone (55–70)")
    elif rsi < 45:
        reasons.append(f"📉 **RSI = {rsi:.1f}** → Bearish momentum zone (30–45)")
    else:
        reasons.append(f"➡️ **RSI = {rsi:.1f}** → Neutral zone (45–55)")

    # ── MACD ──
    macd = float(row.get("MACD", 0))
    macd_sig = float(row.get("MACD_Signal", 0))
    macd_hist = float(row.get("MACD_Hist", 0))
    prev_hist = float(prev.get("MACD_Hist", 0))

    if macd > macd_sig:
        reasons.append(f"✅ **MACD ({macd:.4f})** above signal **({macd_sig:.4f})** → Bullish")
    else:
        reasons.append(f"🔴 **MACD ({macd:.4f})** below signal **({macd_sig:.4f})** → Bearish")

    if macd_hist > 0 and macd_hist > prev_hist:
        reasons.append("✅ **MACD Histogram** expanding upward → Strengthening bullish move")
    elif macd_hist < 0 and macd_hist < prev_hist:
        reasons.append("🔴 **MACD Histogram** expanding downward → Strengthening bearish move")

    # ── Bollinger Bands ──
    bb_upper = float(row.get("BB_Upper", close))
    bb_lower = float(row.get("BB_Lower", close))
    bb_mid = float(row.get("BB_Mid", close))
    bb_range = bb_upper - bb_lower + 1e-10
    bb_pos = (close - bb_lower) / bb_range * 100

    if close > bb_upper:
        reasons.append(f"⚠️ Price **above Upper BB ({bb_upper:.4f})** → Overbought / breakout zone")
    elif close < bb_lower:
        reasons.append(f"✅ Price **below Lower BB ({bb_lower:.4f})** → Oversold / reversal zone")
    else:
        reasons.append(f"➡️ Price at **{bb_pos:.0f}%** of Bollinger Band range")

    # ── Stochastic ──
    stoch_k = float(row.get("Stoch_K", 50))
    stoch_d = float(row.get("Stoch_D", 50))
    if stoch_k > 80:
        reasons.append(f"⚠️ **Stoch %K = {stoch_k:.1f}** → Overbought territory")
    elif stoch_k < 20:
        reasons.append(f"✅ **Stoch %K = {stoch_k:.1f}** → Oversold territory — watch for bounce")
    elif stoch_k > stoch_d:
        reasons.append(f"✅ **Stoch %K ({stoch_k:.1f}) > %D ({stoch_d:.1f})** → Bullish crossover")
    else:
        reasons.append(f"🔴 **Stoch %K ({stoch_k:.1f}) < %D ({stoch_d:.1f})** → Bearish crossover")

    # ── ATR / Volatility ──
    atr = float(row.get("ATR", 0))
    reasons.append(f"📊 **ATR = {atr:.5f}** → Current volatility used to set dynamic SL/TP")

    return reasons
