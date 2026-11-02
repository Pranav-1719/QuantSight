"""
signal_engine.py — ML Signal Generator
Loads existing model.pkl and nn_model.keras, generates BUY/SELL/HOLD signal with confidence %.
Falls back gracefully if models are unavailable.
"""

import numpy as np
import pandas as pd
from pathlib import Path

MODEL_DIR = Path(__file__).parent.parent / "model"

# Features expected by the trained models (must match notebook training order)
FEATURES = ["Close", "Volume", "High", "Low", "Open", "MA_10", "MA_50", "Volatility"]


# ──────────────────────────────────────────────
# Model Loader (cached via Streamlit in app.py)
# ──────────────────────────────────────────────
def load_ml_model():
    """Load the sklearn Linear Regression pipeline."""
    import joblib
    return joblib.load(MODEL_DIR / "model.pkl")


def load_nn_model():
    """Load Keras Neural Network + its scaler."""
    import joblib
    from tensorflow import keras  # type: ignore
    nn_model = keras.models.load_model(MODEL_DIR / "nn_model.keras")
    nn_scaler = joblib.load(MODEL_DIR / "nn_scaler.pkl")
    return nn_model, nn_scaler


# ──────────────────────────────────────────────
# Feature row builder
# ──────────────────────────────────────────────
def _build_feature_row(df: pd.DataFrame) -> np.ndarray:
    """Extract the latest row of features for model inference."""
    clean = df.dropna(subset=FEATURES)
    if clean.empty:
        raise ValueError("Not enough data to build feature row.")
    row = clean.iloc[-1][FEATURES].values.reshape(1, -1)
    return row.astype(float)


# ──────────────────────────────────────────────
# Prediction (with graceful fallback)
# ──────────────────────────────────────────────
def _predict_price(df: pd.DataFrame, model_choice: str) -> float:
    """Run the chosen model and return predicted price."""
    feature_row = _build_feature_row(df)
    current_price = float(df.dropna().iloc[-1]["Close"])

    if model_choice == "Neural Network":
        try:
            nn_model, nn_scaler = load_nn_model()
            scaled = nn_scaler.transform(feature_row)
            pred = float(nn_model.predict(scaled, verbose=0)[0][0])
            return pred
        except Exception:
            pass  # fall through to ML model

    if model_choice in ("Linear Regression", "Neural Network"):
        try:
            ml_model = load_ml_model()
            pred = float(ml_model.predict(feature_row)[0])
            return pred
        except Exception:
            pass

    # ── Fallback: momentum heuristic ──
    row = df.dropna().iloc[-1]
    momentum = row.get("Daily_Return", 0)
    rsi = row.get("RSI", 50)
    rsi_factor = (rsi - 50) / 200  # small directional nudge from RSI
    predicted = current_price * (1 + (momentum * 0.4) + rsi_factor * 0.01)
    return predicted


# ──────────────────────────────────────────────
# Confidence Score (ATR-normalised)
# ──────────────────────────────────────────────
def _compute_confidence(predicted: float, current: float, atr: float) -> float:
    if atr <= 0:
        return 50.0
    raw = abs(predicted - current) / atr * 30
    return round(min(95.0, max(10.0, raw)), 1)


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────
def get_signal(df: pd.DataFrame, model_choice: str = "Neural Network") -> dict:
    """
    Returns a signal dict with keys:
        signal, signal_color, signal_emoji, predicted_price,
        current_price, pct_change, confidence, model_used, atr
    """
    row = df.dropna().iloc[-1]
    current_price = float(row["Close"])
    atr = float(row.get("ATR", 0))

    predicted_price = _predict_price(df, model_choice)
    pct_change = (predicted_price - current_price) / (current_price + 1e-10) * 100

    # Dynamic threshold: tighter for low-volatility assets
    threshold = max(0.3, (atr / (current_price + 1e-10)) * 50)

    if pct_change > threshold:
        signal, color, emoji = "BUY", "#00C851", "🟢"
    elif pct_change < -threshold:
        signal, color, emoji = "SELL", "#FF4444", "🔴"
    else:
        signal, color, emoji = "HOLD", "#FFD700", "🟡"

    confidence = _compute_confidence(predicted_price, current_price, atr)

    return {
        "signal": signal,
        "signal_color": color,
        "signal_emoji": emoji,
        "predicted_price": round(predicted_price, 5),
        "current_price": round(current_price, 5),
        "pct_change": round(pct_change, 3),
        "confidence": confidence,
        "model_used": model_choice,
        "atr": round(atr, 5),
    }
