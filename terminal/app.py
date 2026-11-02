"""
app.py — QuantSight Trading Terminal
A professional trading terminal with:
  • TradingView-style candlestick chart (SL/TP lines on chart)
  • ML signal + confidence score panel
  • Trade call card (Entry, SL, TP, R:R)
  • Trade logic & step-by-step guidance
  • Live RSS news feed (Myfxbook, ForexFactory, ET India, Moneycontrol)

Run: streamlit run terminal/app.py
"""

import sys
from pathlib import Path

# Ensure project root is in path for model imports
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st
import pandas as pd
import yfinance as yf
from datetime import datetime

from indicators import add_all_indicators, detect_pattern
from signal_engine import get_signal
from trade_logic import compute_trade_call, get_trade_logic, get_trade_steps
from news_feed import fetch_news, get_impact_badge

# ──────────────────────────────────────────────
# Page Config
# ──────────────────────────────────────────────
st.set_page_config(
    page_title="QuantSight Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ──────────────────────────────────────────────
# Custom CSS (TradingView-inspired dark theme)
# ──────────────────────────────────────────────
st.markdown(
    """
    <style>
    /* Base dark background */
    .stApp { background-color: #131722; color: #d1d4dc; }
    .main .block-container { padding: 0.75rem 1rem; }

    /* Header bar */
    .terminal-header {
        background: #1e2230;
        border-bottom: 1px solid #2a2e39;
        padding: 8px 16px;
        border-radius: 6px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    /* Signal card */
    .signal-card {
        background: #1e2230;
        border-radius: 8px;
        border: 1px solid #2a2e39;
        padding: 14px;
        margin-bottom: 10px;
    }

    /* Signal BUY */
    .signal-buy {
        border-left: 4px solid #26a69a;
        background: linear-gradient(90deg, #1a2e2e 0%, #1e2230 100%);
    }

    /* Signal SELL */
    .signal-sell {
        border-left: 4px solid #ef5350;
        background: linear-gradient(90deg, #2e1a1a 0%, #1e2230 100%);
    }

    /* Signal HOLD */
    .signal-hold {
        border-left: 4px solid #FFD700;
        background: linear-gradient(90deg, #2e2a1a 0%, #1e2230 100%);
    }

    /* Trade call card */
    .trade-card {
        background: #1e2230;
        border-radius: 8px;
        border: 1px solid #2a2e39;
        padding: 14px;
        margin-bottom: 10px;
    }

    /* Metric row */
    .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid #2a2e39;
    }
    .metric-label { color: #787b86; font-size: 12px; }
    .metric-value { font-weight: bold; font-size: 14px; }
    .metric-green { color: #26a69a; }
    .metric-red { color: #ef5350; }
    .metric-orange { color: #f39c12; }

    /* News item */
    .news-item {
        background: #1e2230;
        border-radius: 6px;
        border-left: 3px solid #2a2e39;
        padding: 8px 12px;
        margin-bottom: 6px;
    }
    .news-title { font-size: 13px; font-weight: 500; color: #d1d4dc; }
    .news-meta { font-size: 11px; color: #787b86; margin-top: 3px; }

    /* Section header */
    .section-header {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #787b86;
        margin: 10px 0 6px 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #2a2e39;
    }

    /* Confidence bar */
    .conf-bar-bg {
        background: #2a2e39;
        border-radius: 4px;
        height: 6px;
        margin-top: 6px;
    }

    /* Logic step */
    .logic-step {
        font-size: 12px;
        padding: 4px 0;
        color: #c8ccd4;
    }

    /* Steps */
    .step-box {
        background: #1a1f2e;
        border: 1px solid #2a2e39;
        border-radius: 6px;
        padding: 10px 14px;
        margin-bottom: 6px;
        font-size: 12px;
        color: #c8ccd4;
    }

    /* Streamlit widget label overrides */
    label, .stSelectbox label, .stRadio label { color: #787b86 !important; font-size: 12px !important; }

    /* Hide streamlit branding */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    header { visibility: hidden; }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { background: #1e2230; border-radius: 6px; }
    .stTabs [data-baseweb="tab"] { color: #787b86; }
    .stTabs [aria-selected="true"] { color: #d1d4dc; }
    </style>
    """,
    unsafe_allow_html=True,
)


# ──────────────────────────────────────────────
# Symbol Catalogue
# ──────────────────────────────────────────────
SYMBOLS = {
    "── FOREX ──": None,
    "EUR/USD": "EURUSD=X",
    "GBP/USD": "GBPUSD=X",
    "USD/JPY": "USDJPY=X",
    "USD/INR": "USDINR=X",
    "EUR/INR": "EURINR=X",
    "GBP/INR": "GBPINR=X",
    "AUD/USD": "AUDUSD=X",
    "USD/CAD": "USDCAD=X",
    "XAU/USD (Spot Gold)": "GC=F",
    "── INDIAN STOCKS (NSE) ──": None,
    "Reliance Industries": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "Infosys": "INFY.NS",
    "HDFC Bank": "HDFCBANK.NS",
    "ICICI Bank": "ICICIBANK.NS",
    "Wipro": "WIPRO.NS",
    "NIFTY 50": "^NSEI",
    "SENSEX": "^BSESN",
    "BSE Midcap": "^BSEMIDC",
    "── COMMODITIES ──": None,
    "Gold Futures": "GC=F",
    "Silver Futures": "SI=F",
    "Crude Oil (WTI)": "CL=F",
    "Brent Crude": "BZ=F",
    "Natural Gas": "NG=F",
    "Copper": "HG=F",
}

TIMEFRAMES = {
    "1D": {"period": "6mo", "interval": "1d"},
    "4H": {"period": "60d", "interval": "4h"},
    "1H": {"period": "30d", "interval": "60m"},
    "15m": {"period": "7d", "interval": "15m"},
    "Weekly": {"period": "2y", "interval": "1wk"},
}


# ──────────────────────────────────────────────
# Data Fetcher (cached 5 min)
# ──────────────────────────────────────────────
@st.cache_data(ttl=300)
def fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    df = yf.download(ticker, period=period, interval=interval, auto_adjust=True, progress=False)
    if df.empty:
        return df
    # Flatten MultiIndex columns if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
    return df


@st.cache_data(ttl=600)
def fetch_news_cached() -> list[dict]:
    return fetch_news(market_filter=["forex", "stocks", "commodity"], max_items=25)


# ──────────────────────────────────────────────
# Header Bar
# ──────────────────────────────────────────────
st.markdown(
    '<div class="terminal-header">'
    '  <span style="font-size:22px;">📈</span>'
    '  <span style="font-size:18px;font-weight:700;color:#d1d4dc;letter-spacing:0.05em;">QuantSight</span>'
    '  <span style="font-size:12px;color:#787b86;margin-left:4px;">Trading Terminal</span>'
    f'  <span style="font-size:11px;color:#4a5060;margin-left:auto;">{datetime.now().strftime("%d %b %Y  %H:%M:%S IST")}</span>'
    "</div>",
    unsafe_allow_html=True,
)

# ──────────────────────────────────────────────
# Control Bar
# ──────────────────────────────────────────────
ctrl1, ctrl2, ctrl3, ctrl4, ctrl5 = st.columns([3, 2, 2, 2, 1])

with ctrl1:
    display_names = [k for k in SYMBOLS.keys()]
    selected_display = st.selectbox(
        "Symbol",
        options=display_names,
        index=display_names.index("EUR/USD"),
        key="symbol_select",
    )
    ticker = SYMBOLS.get(selected_display)

with ctrl2:
    timeframe = st.selectbox("Timeframe", options=list(TIMEFRAMES.keys()), index=0, key="tf_select")

with ctrl3:
    model_choice = st.selectbox(
        "Model",
        options=["Neural Network", "Linear Regression"],
        key="model_select",
    )

with ctrl4:
    show_ma = st.checkbox("Show MA/EMA", value=True)
    show_volume = st.checkbox("Show Volume", value=True)

with ctrl5:
    refresh = st.button("🔄 Refresh", type="primary", use_container_width=True)
    if refresh:
        st.cache_data.clear()

st.divider()

# ──────────────────────────────────────────────
# Validate symbol
# ──────────────────────────────────────────────
if ticker is None:
    st.info("👆 Select a symbol from the dropdown above to begin.")
    st.stop()

# ──────────────────────────────────────────────
# Fetch Data
# ──────────────────────────────────────────────
tf_params = TIMEFRAMES[timeframe]
with st.spinner(f"Loading {selected_display} ({timeframe})…"):
    raw_df = fetch_ohlcv(ticker, tf_params["period"], tf_params["interval"])

if raw_df is None or raw_df.empty:
    st.error(f"❌ Could not fetch data for **{selected_display}** (`{ticker}`). Try another symbol or timeframe.")
    st.stop()

df = add_all_indicators(raw_df)

# ──────────────────────────────────────────────
# Generate Signal & Trade Call
# ──────────────────────────────────────────────
try:
    signal_data = get_signal(df, model_choice)
except Exception as e:
    st.warning(f"Signal engine error: {e}. Using fallback.")
    # Minimal fallback signal
    signal_data = {
        "signal": "HOLD",
        "signal_color": "#FFD700",
        "signal_emoji": "🟡",
        "predicted_price": float(df["Close"].iloc[-1]),
        "current_price": float(df["Close"].iloc[-1]),
        "pct_change": 0.0,
        "confidence": 50.0,
        "model_used": model_choice,
        "atr": float(df["ATR"].iloc[-1]) if "ATR" in df.columns else 0.01,
    }

trade = compute_trade_call(df, signal_data["signal"], signal_data["atr"])
logic_reasons = get_trade_logic(df, signal_data["signal"])
trade_steps = get_trade_steps(df, signal_data["signal"], trade)
pattern = detect_pattern(df)

# ──────────────────────────────────────────────
# Main Layout: Chart (left) | Panels (right)
# ──────────────────────────────────────────────
chart_col, panel_col = st.columns([3, 1.15])

# ═══════════════════════════════
# LEFT — CHART
# ═══════════════════════════════
with chart_col:
    # Chart ticker info bar
    current_price = signal_data["current_price"]
    pct = signal_data["pct_change"]
    pct_color = "#26a69a" if pct >= 0 else "#ef5350"
    pct_arrow = "▲" if pct >= 0 else "▼"

    st.markdown(
        f'<div style="background:#1e2230;border-radius:6px;padding:8px 14px;margin-bottom:8px;display:flex;align-items:center;gap:16px;">'
        f'  <span style="font-size:16px;font-weight:700;color:#d1d4dc;">{selected_display}</span>'
        f'  <span style="font-size:14px;color:#d1d4dc;">{current_price:.5f}</span>'
        f'  <span style="font-size:13px;color:{pct_color};">{pct_arrow} {abs(pct):.3f}%</span>'
        f'  <span style="font-size:11px;color:#787b86;margin-left:8px;">ATR: {signal_data["atr"]:.5f}</span>'
        f'  <span style="font-size:11px;color:#787b86;">Pattern: {pattern}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # Chart rendering
    try:
        from streamlit_lightweight_charts import renderLightweightCharts
        from chart_builder import build_chart_config

        chart_config = build_chart_config(
            df=df,
            entry=trade["entry"],
            sl=trade["sl"],
            tp=trade["tp"],
            signal=signal_data["signal"],
            show_ma=show_ma,
            show_volume=show_volume,
            height=480,
        )
        renderLightweightCharts(chart_config, key="main_chart")

    except ImportError:
        # Fallback to Plotly if streamlit-lightweight-charts not installed
        import plotly.graph_objects as go

        fig = go.Figure()

        # Candlesticks
        fig.add_trace(go.Candlestick(
            x=df.index,
            open=df["Open"],
            high=df["High"],
            low=df["Low"],
            close=df["Close"],
            name=selected_display,
            increasing_line_color="#26a69a",
            decreasing_line_color="#ef5350",
        ))

        # MA Lines
        if show_ma:
            for col, color, name in [
                ("MA_10", "#f7dc6f", "MA10"),
                ("MA_50", "#5dade2", "MA50"),
                ("EMA_21", "#af7ac5", "EMA21"),
            ]:
                if col in df.columns:
                    fig.add_trace(go.Scatter(
                        x=df.index, y=df[col], mode="lines",
                        name=name, line=dict(color=color, width=1),
                    ))

        # SL/TP horizontal lines
        fig.add_hline(y=trade["sl"], line_color="#ef5350", line_dash="dash",
                      annotation_text=f"SL {trade['sl']:.5f}", annotation_position="right")
        fig.add_hline(y=trade["tp"], line_color="#26a69a", line_dash="dash",
                      annotation_text=f"TP {trade['tp']:.5f} (1:{trade['rr']})", annotation_position="right")
        fig.add_hline(y=trade["entry"], line_color="#f39c12", line_dash="dot",
                      annotation_text=f"Entry {trade['entry']:.5f}", annotation_position="right")

        fig.update_layout(
            paper_bgcolor="#131722",
            plot_bgcolor="#131722",
            font=dict(color="#d1d4dc"),
            xaxis=dict(gridcolor="#1e2230", showgrid=True),
            yaxis=dict(gridcolor="#1e2230", showgrid=True),
            xaxis_rangeslider_visible=False,
            margin=dict(l=0, r=80, t=10, b=0),
            height=480,
            legend=dict(
                bgcolor="#1e2230",
                bordercolor="#2a2e39",
                orientation="h",
                yanchor="bottom",
                y=1.01,
            ),
        )
        st.plotly_chart(fig, use_container_width=True)

    # SL/TP Legend
    sl_pct = trade["sl_pct"]
    tp_pct = trade["tp_pct"]
    st.markdown(
        f'<div style="display:flex;gap:16px;font-size:11px;padding:6px 0;">'
        f'  <span>🟠 Entry: <b>{trade["entry"]:.5f}</b></span>'
        f'  <span>🔴 SL: <b>{trade["sl"]:.5f}</b> <span style="color:#ef5350">(-{sl_pct:.2f}%)</span></span>'
        f'  <span>🟢 TP: <b>{trade["tp"]:.5f}</b> <span style="color:#26a69a">(+{tp_pct:.2f}%)</span></span>'
        f'  <span style="color:#787b86">R:R → <b style="color:#d1d4dc">1:{trade["rr"]:.1f}</b></span>'
        f'</div>',
        unsafe_allow_html=True,
    )

# ═══════════════════════════════
# RIGHT — SIGNAL + TRADE PANELS
# ═══════════════════════════════
with panel_col:

    # ── SIGNAL PANEL ──
    signal = signal_data["signal"]
    signal_class = {"BUY": "signal-buy", "SELL": "signal-sell", "HOLD": "signal-hold"}[signal]
    conf = signal_data["confidence"]
    conf_bar_color = {"BUY": "#26a69a", "SELL": "#ef5350", "HOLD": "#FFD700"}[signal]

    st.markdown(f'<div class="section-header">📊 MODEL SIGNAL</div>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="signal-card {signal_class}">'
        f'  <div style="font-size:26px;font-weight:800;color:{signal_data["signal_color"]};">'
        f'    {signal_data["signal_emoji"]} {signal}'
        f'  </div>'
        f'  <div style="font-size:11px;color:#787b86;margin-top:6px;">Confidence</div>'
        f'  <div style="font-size:20px;font-weight:700;color:{conf_bar_color};">{conf}%</div>'
        f'  <div class="conf-bar-bg"><div style="height:6px;border-radius:4px;background:{conf_bar_color};width:{conf}%;"></div></div>'
        f'  <div style="margin-top:10px;font-size:11px;color:#787b86;">Predicted Price</div>'
        f'  <div style="font-size:14px;font-weight:600;color:#d1d4dc;">{signal_data["predicted_price"]:.5f}</div>'
        f'  <div style="font-size:11px;color:#787b86;margin-top:6px;">Model: <span style="color:#d1d4dc;">{signal_data["model_used"]}</span></div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── TRADE CALL PANEL ──
    st.markdown('<div class="section-header">📋 TRADE CALL</div>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="trade-card">'
        f'  <div class="metric-row"><span class="metric-label">Entry</span>'
        f'    <span class="metric-value metric-orange">{trade["entry"]:.5f}</span></div>'
        f'  <div class="metric-row"><span class="metric-label">Stop Loss</span>'
        f'    <span class="metric-value metric-red">{trade["sl"]:.5f} <span style="font-size:10px">(-{trade["sl_pct"]:.2f}%)</span></span></div>'
        f'  <div class="metric-row"><span class="metric-label">Take Profit</span>'
        f'    <span class="metric-value metric-green">{trade["tp"]:.5f} <span style="font-size:10px">(+{trade["tp_pct"]:.2f}%)</span></span></div>'
        f'  <div class="metric-row"><span class="metric-label">Risk</span>'
        f'    <span class="metric-value metric-red">{trade["risk"]:.5f}</span></div>'
        f'  <div class="metric-row"><span class="metric-label">Reward</span>'
        f'    <span class="metric-value metric-green">{trade["reward"]:.5f}</span></div>'
        f'  <div class="metric-row" style="border:none;"><span class="metric-label">R : R Ratio</span>'
        f'    <span class="metric-value" style="color:#f39c12;font-size:16px;">1 : {trade["rr"]:.1f}</span></div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── TRADE LOGIC (collapsible) ──
    with st.expander("🧠 Trade Logic", expanded=True):
        for reason in logic_reasons:
            st.markdown(f'<div class="logic-step">{reason}</div>', unsafe_allow_html=True)

# ──────────────────────────────────────────────
# BOTTOM SECTION — Steps + News
# ──────────────────────────────────────────────
st.divider()
steps_col, news_col = st.columns([1, 1])

# ── TRADE STEPS ──
with steps_col:
    st.markdown('<div class="section-header">🚦 TRADE EXECUTION STEPS</div>', unsafe_allow_html=True)
    for step in trade_steps:
        st.markdown(f'<div class="step-box">{step}</div>', unsafe_allow_html=True)

# ── NEWS FEED ──
with news_col:
    st.markdown('<div class="section-header">📰 LIVE NEWS FEED</div>', unsafe_allow_html=True)

    news_tab1, news_tab2 = st.tabs(["🌐 All News", "🔴 High Impact"])

    with st.spinner("Fetching news…"):
        news_items = fetch_news_cached()

    with news_tab1:
        if news_items:
            for item in news_items[:12]:
                impact = get_impact_badge(item["title"])
                st.markdown(
                    f'<div class="news-item">'
                    f'  <div class="news-title">{item["title"]}</div>'
                    f'  <div class="news-meta">'
                    f'    {item["tag"]} · {item["source"]} · {item["time"]} &nbsp;|&nbsp; {impact}'
                    f'  </div>'
                    f'  {"<div style=\'font-size:11px;color:#9ca3af;margin-top:3px;\'>" + item["description"][:100] + "...</div>" if item.get("description") else ""}'
                    f'</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.info("📡 News sources unreachable. Check your internet connection.")

    with news_tab2:
        high_impact = [
            n for n in news_items
            if "HIGH" in get_impact_badge(n["title"])
        ]
        if high_impact:
            for item in high_impact[:8]:
                st.markdown(
                    f'<div class="news-item" style="border-left-color:#ef5350;">'
                    f'  <div class="news-title">🔴 {item["title"]}</div>'
                    f'  <div class="news-meta">{item["tag"]} · {item["time"]}</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
        else:
            st.success("✅ No high-impact events detected in current feed.")

# ──────────────────────────────────────────────
# Footer
# ──────────────────────────────────────────────
st.markdown(
    '<div style="text-align:center;color:#3a3f4f;font-size:11px;margin-top:20px;padding:10px;">'
    "QuantSight Terminal — For Educational & Research Use Only. Not Financial Advice."
    "</div>",
    unsafe_allow_html=True,
)
