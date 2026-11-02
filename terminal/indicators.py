"""
indicators.py — Technical Indicator Engine (Pure pandas/numpy, no external TA lib dependency)
Computes: RSI, MACD, Bollinger Bands, ATR, MA10, MA50, EMA21, Volatility, Daily Return
"""

import pandas as pd
import numpy as np


# ──────────────────────────────────────────────
# RSI (Wilder's Smoothing)
# ──────────────────────────────────────────────
def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


# ──────────────────────────────────────────────
# MACD
# ──────────────────────────────────────────────
def compute_macd(
    series: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


# ──────────────────────────────────────────────
# Bollinger Bands
# ──────────────────────────────────────────────
def compute_bollinger_bands(
    series: pd.Series,
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    ma = series.rolling(period).mean()
    std = series.rolling(period).std()
    upper = ma + num_std * std
    lower = ma - num_std * std
    return upper, ma, lower


# ──────────────────────────────────────────────
# ATR (Wilder's EMA method)
# ──────────────────────────────────────────────
def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["High"]
    low = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat(
        [
            (high - low),
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


# ──────────────────────────────────────────────
# Stochastic Oscillator
# ──────────────────────────────────────────────
def compute_stochastic(
    df: pd.DataFrame, period: int = 14, smooth_k: int = 3, smooth_d: int = 3
) -> tuple[pd.Series, pd.Series]:
    low_min = df["Low"].rolling(period).min()
    high_max = df["High"].rolling(period).max()
    k = 100 * (df["Close"] - low_min) / (high_max - low_min + 1e-10)
    k_smooth = k.rolling(smooth_k).mean()
    d = k_smooth.rolling(smooth_d).mean()
    return k_smooth, d


# ──────────────────────────────────────────────
# Master function — add all indicators to df
# ──────────────────────────────────────────────
def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Trend
    df["MA_10"] = df["Close"].rolling(10).mean()
    df["MA_50"] = df["Close"].rolling(50).mean()
    df["EMA_21"] = df["Close"].ewm(span=21, adjust=False).mean()

    # Momentum
    df["RSI"] = compute_rsi(df["Close"])
    df["MACD"], df["MACD_Signal"], df["MACD_Hist"] = compute_macd(df["Close"])
    df["Stoch_K"], df["Stoch_D"] = compute_stochastic(df)

    # Volatility
    df["BB_Upper"], df["BB_Mid"], df["BB_Lower"] = compute_bollinger_bands(df["Close"])
    df["ATR"] = compute_atr(df)
    df["Volatility"] = df["Close"].rolling(10).std()

    # Return
    df["Daily_Return"] = df["Close"].pct_change()

    return df


# ──────────────────────────────────────────────
# Candlestick pattern detection (simple heuristics)
# ──────────────────────────────────────────────
def detect_pattern(df: pd.DataFrame) -> str:
    """Return the most recent candlestick pattern name."""
    if len(df) < 2:
        return "No Pattern"

    row = df.iloc[-1]
    prev = df.iloc[-2]

    body = abs(row["Close"] - row["Open"])
    prev_body = abs(prev["Close"] - prev["Open"])
    total_range = row["High"] - row["Low"] + 1e-10

    # Doji
    if body / total_range < 0.1:
        return "🕯️ Doji (Indecision)"

    # Bullish Engulfing
    if (
        prev["Close"] < prev["Open"]
        and row["Close"] > row["Open"]
        and row["Open"] < prev["Close"]
        and row["Close"] > prev["Open"]
    ):
        return "🟢 Bullish Engulfing"

    # Bearish Engulfing
    if (
        prev["Close"] > prev["Open"]
        and row["Close"] < row["Open"]
        and row["Open"] > prev["Close"]
        and row["Close"] < prev["Open"]
    ):
        return "🔴 Bearish Engulfing"

    # Hammer
    lower_shadow = min(row["Open"], row["Close"]) - row["Low"]
    upper_shadow = row["High"] - max(row["Open"], row["Close"])
    if lower_shadow > 2 * body and upper_shadow < 0.3 * body:
        return "🔨 Hammer (Bullish)"

    # Shooting Star
    if upper_shadow > 2 * body and lower_shadow < 0.3 * body:
        return "⭐ Shooting Star (Bearish)"

    # Marubozu
    if body / total_range > 0.9:
        if row["Close"] > row["Open"]:
            return "📈 Bullish Marubozu"
        else:
            return "📉 Bearish Marubozu"

    return "➡️ No Clear Pattern"
