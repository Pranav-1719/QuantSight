"""
chart_builder.py — Chart Data Preparation for streamlit-lightweight-charts
Builds OHLCV candlestick series, MA/EMA overlays, and SL/TP price lines.
"""

import pandas as pd
import numpy as np
from typing import Optional


# ──────────────────────────────────────────────
# Colour Palette (TradingView Dark Theme)
# ──────────────────────────────────────────────
COLORS = {
    "bg": "#131722",
    "text": "#d1d4dc",
    "grid": "#1e2230",
    "border": "#2a2e39",
    "candle_up": "#26a69a",
    "candle_down": "#ef5350",
    "wick_up": "#26a69a",
    "wick_down": "#ef5350",
    "ma10": "#f7dc6f",
    "ma50": "#5dade2",
    "ema21": "#af7ac5",
    "sl": "#ef5350",
    "tp": "#26a69a",
    "entry": "#f39c12",
    "volume_up": "#26a69a",
    "volume_down": "#ef5350",
}

LINE_STYLE_DASHED = 2
LINE_STYLE_SOLID = 0


# ──────────────────────────────────────────────
# Date normalizer
# ──────────────────────────────────────────────
def _to_timestamp(dt) -> int:
    """Convert pandas Timestamp to UNIX seconds (required by lightweight-charts)."""
    try:
        return int(pd.Timestamp(dt).timestamp())
    except Exception:
        return 0


# ──────────────────────────────────────────────
# Candlestick Series
# ──────────────────────────────────────────────
def build_candle_series(df: pd.DataFrame) -> list[dict]:
    """Convert OHLCV DataFrame to lightweight-charts candlestick format."""
    series = []
    for idx, row in df.iterrows():
        try:
            series.append({
                "time": _to_timestamp(idx),
                "open": round(float(row["Open"]), 5),
                "high": round(float(row["High"]), 5),
                "low": round(float(row["Low"]), 5),
                "close": round(float(row["Close"]), 5),
            })
        except Exception:
            continue
    return series


# ──────────────────────────────────────────────
# Volume Series (histogram)
# ──────────────────────────────────────────────
def build_volume_series(df: pd.DataFrame) -> list[dict]:
    """Build volume histogram series with up/down colouring."""
    series = []
    for idx, row in df.iterrows():
        try:
            is_up = float(row["Close"]) >= float(row["Open"])
            series.append({
                "time": _to_timestamp(idx),
                "value": round(float(row["Volume"]), 0),
                "color": COLORS["volume_up"] + "80" if is_up else COLORS["volume_down"] + "80",
            })
        except Exception:
            continue
    return series


# ──────────────────────────────────────────────
# Moving Average Line Series
# ──────────────────────────────────────────────
def build_ma_series(df: pd.DataFrame, col: str) -> list[dict]:
    """Build a line series for the given indicator column."""
    series = []
    for idx, row in df.iterrows():
        val = row.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            continue
        try:
            series.append({
                "time": _to_timestamp(idx),
                "value": round(float(val), 5),
            })
        except Exception:
            continue
    return series


# ──────────────────────────────────────────────
# Price Lines (SL / TP / Entry horizontal lines)
# ──────────────────────────────────────────────
def build_price_lines(
    entry: float,
    sl: float,
    tp: float,
    signal: str,
) -> list[dict]:
    """Build price line annotations for SL, TP, and Entry levels."""
    rr = abs(tp - entry) / (abs(entry - sl) + 1e-10)

    return [
        {
            "price": round(entry, 5),
            "color": COLORS["entry"],
            "lineWidth": 1,
            "lineStyle": LINE_STYLE_SOLID,
            "axisLabelVisible": True,
            "title": f"Entry {signal}",
        },
        {
            "price": round(sl, 5),
            "color": COLORS["sl"],
            "lineWidth": 2,
            "lineStyle": LINE_STYLE_DASHED,
            "axisLabelVisible": True,
            "title": f"SL {sl:.5f}",
        },
        {
            "price": round(tp, 5),
            "color": COLORS["tp"],
            "lineWidth": 2,
            "lineStyle": LINE_STYLE_DASHED,
            "axisLabelVisible": True,
            "title": f"TP {tp:.5f} (1:{rr:.1f})",
        },
    ]


# ──────────────────────────────────────────────
# Full Chart Config Builder
# ──────────────────────────────────────────────
def build_chart_config(
    df: pd.DataFrame,
    entry: float,
    sl: float,
    tp: float,
    signal: str,
    show_ma: bool = True,
    show_volume: bool = True,
    height: int = 520,
) -> list[dict]:
    """
    Returns the full chart config list for renderLightweightCharts().
    Layout: main chart (candles + MAs + SL/TP) on top, volume below.
    """
    price_lines = build_price_lines(entry, sl, tp, signal)

    # Main chart series
    main_series = [
        {
            "type": "Candlestick",
            "data": build_candle_series(df),
            "options": {
                "upColor": COLORS["candle_up"],
                "downColor": COLORS["candle_down"],
                "borderUpColor": COLORS["wick_up"],
                "borderDownColor": COLORS["wick_down"],
                "wickUpColor": COLORS["wick_up"],
                "wickDownColor": COLORS["wick_down"],
                "priceLineVisible": False,
            },
            "priceLines": price_lines,
        }
    ]

    if show_ma:
        ma10_data = build_ma_series(df, "MA_10")
        ma50_data = build_ma_series(df, "MA_50")
        ema21_data = build_ma_series(df, "EMA_21")

        if ma10_data:
            main_series.append({
                "type": "Line",
                "data": ma10_data,
                "options": {
                    "color": COLORS["ma10"],
                    "lineWidth": 1,
                    "priceLineVisible": False,
                    "title": "MA10",
                    "crosshairMarkerVisible": False,
                },
            })
        if ma50_data:
            main_series.append({
                "type": "Line",
                "data": ma50_data,
                "options": {
                    "color": COLORS["ma50"],
                    "lineWidth": 1,
                    "priceLineVisible": False,
                    "title": "MA50",
                    "crosshairMarkerVisible": False,
                },
            })
        if ema21_data:
            main_series.append({
                "type": "Line",
                "data": ema21_data,
                "options": {
                    "color": COLORS["ema21"],
                    "lineWidth": 1,
                    "priceLineVisible": False,
                    "title": "EMA21",
                    "crosshairMarkerVisible": False,
                },
            })

    charts = [
        {
            "chart": {
                "height": height,
                "layout": {
                    "background": {"type": "solid", "color": COLORS["bg"]},
                    "textColor": COLORS["text"],
                    "fontSize": 12,
                },
                "grid": {
                    "vertLines": {"color": COLORS["grid"], "style": 1},
                    "horzLines": {"color": COLORS["grid"], "style": 1},
                },
                "crosshair": {"mode": 1},
                "rightPriceScale": {
                    "borderColor": COLORS["border"],
                    "visible": True,
                },
                "timeScale": {
                    "borderColor": COLORS["border"],
                    "timeVisible": True,
                    "secondsVisible": False,
                },
                "watermark": {
                    "visible": True,
                    "text": "QuantSight Terminal",
                    "color": "rgba(255,255,255,0.04)",
                    "fontSize": 28,
                },
            },
            "series": main_series,
        }
    ]

    # Volume sub-chart
    if show_volume:
        charts.append({
            "chart": {
                "height": 100,
                "layout": {
                    "background": {"type": "solid", "color": COLORS["bg"]},
                    "textColor": COLORS["text"],
                },
                "grid": {
                    "vertLines": {"visible": False},
                    "horzLines": {"visible": False},
                },
                "rightPriceScale": {
                    "scaleMargins": {"top": 0.0, "bottom": 0.0},
                    "visible": True,
                },
                "timeScale": {"visible": False},
            },
            "series": [
                {
                    "type": "Histogram",
                    "data": build_volume_series(df),
                    "options": {
                        "priceFormat": {"type": "volume"},
                        "priceScaleId": "",
                    },
                }
            ],
        })

    return charts
