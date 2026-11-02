"""
services/data_service.py — Data fetching, indicator computation, OHLCV formatting
"""

import time
from datetime import datetime
from functools import lru_cache
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

# ──────────────────────────────────────────────
# Interval mapping for yfinance
# ──────────────────────────────────────────────
INTERVAL_MAP = {
    "1m": "1m",   "5m": "5m",   "15m": "15m",  "30m": "30m",
    "1h": "60m",  "4h": "4h",   "1d": "1d",    "1wk": "1wk",
}

DEFAULT_PERIODS = {
    "1m": "7d",   "5m": "7d",   "15m": "30d",  "30m": "60d",
    "1h": "60d",  "4h": "60d",  "1d": "1y",    "1wk": "5y",
}


# ──────────────────────────────────────────────
# Indicator Functions
# ──────────────────────────────────────────────

def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


def _stoch_rsi(close: pd.Series, rsi_period=14, stoch_period=14, k_smooth=3, d_smooth=3):
    """StochRSI: applies Stochastic formula to RSI values. Returns %K and %D (0-100 scale)."""
    rsi = _rsi(close, rsi_period)
    rsi_min = rsi.rolling(stoch_period).min()
    rsi_max = rsi.rolling(stoch_period).max()
    stoch = (rsi - rsi_min) / (rsi_max - rsi_min + 1e-10)
    k = stoch.rolling(k_smooth).mean() * 100
    d = k.rolling(d_smooth).mean()
    return k, d


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, prev_close = df["High"], df["Low"], df["Close"].shift(1)
    tr = pd.concat([(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


# ──────────────────────────────────────────────
# Heikin Ashi Conversion
# ──────────────────────────────────────────────

def compute_heikin_ashi(df: pd.DataFrame) -> pd.DataFrame:
    ha = df.copy()
    opens = df["Open"].values
    closes = df["Close"].values
    highs = df["High"].values
    lows = df["Low"].values
    n = len(df)

    ha_close = (opens + highs + lows + closes) / 4.0
    ha_open = np.zeros(n, dtype=float)
    if n > 0:
        ha_open[0] = (opens[0] + closes[0]) / 2.0
        for i in range(1, n):
            ha_open[i] = (ha_open[i - 1] + ha_close[i - 1]) / 2.0

    ha["HA_Open"] = ha_open
    ha["HA_High"] = np.maximum.reduce([highs, ha_open, ha_close])
    ha["HA_Low"] = np.minimum.reduce([lows, ha_open, ha_close])
    ha["HA_Close"] = ha_close
    return ha


# ──────────────────────────────────────────────
# Add All Indicators
# ──────────────────────────────────────────────

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["EMA_50"] = _ema(df["Close"], 50)
    df["ATR"] = _atr(df)
    df["StochRSI_K"], df["StochRSI_D"] = _stoch_rsi(df["Close"])
    df["RSI"] = _rsi(df["Close"])
    df["Daily_Return"] = df["Close"].pct_change()
    return df


# ──────────────────────────────────────────────
# Fetch OHLCV
# ──────────────────────────────────────────────

def fetch_ohlcv(symbol: str, period: str, interval: str) -> dict:
    yf_interval = INTERVAL_MAP.get(interval, interval)

    raw = yf.download(
        symbol, period=period, interval=yf_interval,
        auto_adjust=True, progress=False
    )

    if raw is None or raw.empty:
        raise ValueError(f"No data returned for {symbol}")

    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    raw = raw[["Open", "High", "Low", "Close", "Volume"]].dropna()
    df = add_indicators(raw)
    df = df.dropna(subset=["EMA_50", "StochRSI_K", "StochRSI_D"])

    ha = compute_heikin_ashi(raw.loc[df.index])

    candles = []
    ema50 = []
    stochrsi = []
    ha_candles = []

    for idx, row in df.iterrows():
        ts = int(pd.Timestamp(idx).timestamp())

        candles.append({
            "time": ts,
            "open": round(float(row["Open"]), 6),
            "high": round(float(row["High"]), 6),
            "low": round(float(row["Low"]), 6),
            "close": round(float(row["Close"]), 6),
            "volume": round(float(row["Volume"]), 0),
        })

        if not pd.isna(row["EMA_50"]):
            ema50.append({"time": ts, "value": round(float(row["EMA_50"]), 6)})

        if not pd.isna(row["StochRSI_K"]) and not pd.isna(row["StochRSI_D"]):
            stochrsi.append({
                "time": ts,
                "k": round(float(row["StochRSI_K"]), 2),
                "d": round(float(row["StochRSI_D"]), 2),
            })

    for idx in df.index:
        if idx in ha.index:
            ts = int(pd.Timestamp(idx).timestamp())
            hr = ha.loc[idx]
            ha_candles.append({
                "time": ts,
                "open": round(float(hr["HA_Open"]), 6),
                "high": round(float(hr["HA_High"]), 6),
                "low": round(float(hr["HA_Low"]), 6),
                "close": round(float(hr["HA_Close"]), 6),
            })

    return {
        "symbol": symbol,
        "interval": interval,
        "candles": candles,
        "heikin_ashi": ha_candles,
        "ema50": ema50,
        "stochrsi": stochrsi,
    }


# ──────────────────────────────────────────────
# Live Price
# ──────────────────────────────────────────────

_price_cache: dict[str, dict] = {}

def get_live_price(symbol: str) -> dict:
    """Get latest price. Cached per symbol with 2s TTL."""
    now = time.time()
    cached = _price_cache.get(symbol)
    if cached and (now - cached["fetched_at"]) < 2:
        return cached["data"]

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = float(info.last_price)
        prev_close = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else price
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0

        data = {
            "symbol": symbol,
            "price": round(price, 6),
            "change": round(change, 6),
            "change_pct": round(change_pct, 3),
            "time": int(now),
        }
    except Exception:
        # Fallback: last close from recent candle
        try:
            raw = yf.download(symbol, period="1d", interval="1m", progress=False, auto_adjust=True)
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = raw.columns.get_level_values(0)
            price = float(raw["Close"].dropna().iloc[-1])
            data = {"symbol": symbol, "price": price, "change": 0, "change_pct": 0, "time": int(now)}
        except Exception:
            return {"symbol": symbol, "price": 0, "change": 0, "change_pct": 0, "time": int(now)}

    _price_cache[symbol] = {"data": data, "fetched_at": now}
    return data
