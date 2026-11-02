"""
services/ai_adaptive_service.py — AI Decision Confirmation & Performance-Adaptive Strategy Engine
Dynamically adjusts strategy thresholds based on journal win-rate and profit metrics.
"""

from typing import Dict, Any, List
try:
    from services.journal_service import get_journal_stats, get_all_trades
except ImportError:
    from backend.services.journal_service import get_journal_stats, get_all_trades

def get_adaptive_parameters() -> Dict[str, Any]:
    """
    Evaluates historical journal performance to dynamically tune strategy parameters.
    - Low win-rate -> Defensive tightening (deeper StochRSI, stricter EMA proximity, higher R:R).
    - High win-rate -> High-Alpha mode (expanded capture, high confidence).
    """
    stats = get_journal_stats()
    closed = stats.get("closed_trades", 0)
    win_rate = stats.get("win_rate", 0.0)
    profit_factor = stats.get("profit_factor", 0.0)
    streak = stats.get("current_streak", 0)
    streak_type = stats.get("streak_type", "NONE")

    # Baseline defaults
    params = {
        "mode": "CALIBRATING",
        "stoch_oversold": 20.0,
        "stoch_overbought": 80.0,
        "ema_proximity_mult": 0.8,
        "min_rr": 2.0,
        "sl_atr_mult": 1.5,
        "tp_atr_mult": 3.0,
        "confidence_threshold": 65,
        "description": "Baseline parameters active while accumulating trade journal history.",
        "win_rate": win_rate,
        "closed_trades": closed,
        "profit_factor": profit_factor,
        "streak": f"{streak} {streak_type}" if streak > 0 else "None"
    }

    if closed < 3:
        params["mode"] = "CALIBRATING"
        params["description"] = f"Journal learning ({closed}/3 closed trades). Using balanced baseline."
        return params

    # Defensive mode: Win rate < 48% OR losing streak >= 2
    if win_rate < 48.0 or (streak_type == "LOST" and streak >= 2):
        params["mode"] = "DEFENSIVE_TIGHT"
        params["stoch_oversold"] = 15.0       # requires deeper pullback
        params["stoch_overbought"] = 85.0     # requires extreme exhaustion
        params["ema_proximity_mult"] = 0.5    # must test 50 EMA closely
        params["min_rr"] = 2.5                # higher R:R required
        params["sl_atr_mult"] = 1.3
        params["tp_atr_mult"] = 3.25          # 3.25 / 1.3 = 2.5 R:R
        params["confidence_threshold"] = 75
        params["description"] = (
            f"Drawdown defense active (WR: {win_rate}%, Streak: {streak}L). "
            f"StochRSI bounds tightened to <15 / >85, EMA tolerance strict (0.5x ATR), min R:R raised to 1:2.5."
        )

    # High-Alpha mode: Win rate >= 60% AND profit factor >= 1.5
    elif win_rate >= 60.0 and profit_factor >= 1.5:
        params["mode"] = "HIGH_ALPHA"
        params["stoch_oversold"] = 23.0       # captures earlier entries
        params["stoch_overbought"] = 77.0
        params["ema_proximity_mult"] = 1.0    # allows wider pullback entries
        params["min_rr"] = 2.0
        params["sl_atr_mult"] = 1.5
        params["tp_atr_mult"] = 3.0
        params["confidence_threshold"] = 55
        params["description"] = (
            f"High accuracy momentum active (WR: {win_rate}%, PF: {profit_factor}). "
            f"AI expanded entry window (<23 / >77) and unlocked aggressive position sizing."
        )

    # Optimal Balanced mode: 48% - 59% win rate
    else:
        params["mode"] = "BALANCED_OPTIMAL"
        params["stoch_oversold"] = 20.0
        params["stoch_overbought"] = 80.0
        params["ema_proximity_mult"] = 0.8
        params["min_rr"] = 2.0
        params["sl_atr_mult"] = 1.5
        params["tp_atr_mult"] = 3.0
        params["confidence_threshold"] = 65
        params["description"] = (
            f"Strategy stable (WR: {win_rate}%, PF: {profit_factor}). "
            f"Standard 50 EMA + StochRSI confluence enforced."
        )

    return params


def confirm_decision(
    symbol: str,
    signal: str,
    current_price: float,
    ema50: float,
    stoch_k: float,
    stoch_d: float,
    stoch_state: str,
    mtf_bias: str,
    ha_pattern_name: str,
    ha_direction: str,
    atr: float,
    statarb_z: float = None,
    statarb_fair: float = None,
) -> Dict[str, Any]:
    """
    Evaluates current trade setup using multi-layered heuristic intelligence,
    PCA Statistical Arbitrage factor z-score, and current AI adaptive parameters.
    """
    adaptive = get_adaptive_parameters()
    mode = adaptive["mode"]
    oversold_limit = adaptive["stoch_oversold"]
    overbought_limit = adaptive["stoch_overbought"]
    ema_prox_limit = adaptive["ema_proximity_mult"] * atr

    score = 50
    reasons: List[str] = []
    warnings: List[str] = []

    is_buy = "BUY" in signal
    is_sell = "SELL" in signal

    # 1. Price vs EMA 50 distance
    ema_dist = abs(current_price - ema50)
    if ema_dist <= ema_prox_limit:
        score += 15
        reasons.append(f"Price is within tight support/resistance zone of 50 EMA ({ema_dist:.5f} <= {ema_prox_limit:.5f}).")
    else:
        score -= 10
        warnings.append(f"Price is extended from 50 EMA by {ema_dist:.5f}. Wait for retest.")

    # 2. StochRSI Confirmation
    if is_buy:
        if stoch_k <= oversold_limit:
            score += 20
            reasons.append(f"StochRSI %K ({stoch_k:.1f}) confirmed oversold below adaptive threshold ({oversold_limit:.1f}).")
        elif stoch_k <= 35:
            score += 10
            reasons.append(f"StochRSI %K ({stoch_k:.1f}) in low accumulation territory.")
        elif stoch_k >= 70:
            score -= 25
            warnings.append(f"Caution: StochRSI is already extended ({stoch_k:.1f}). Buying here risks high exhaustion.")

        if stoch_k > stoch_d:
            score += 10
            reasons.append("Bullish momentum cross: %K leads %D upward.")
        else:
            score -= 10
            warnings.append("%K has not yet crossed above %D.")

    elif is_sell:
        if stoch_k >= overbought_limit:
            score += 20
            reasons.append(f"StochRSI %K ({stoch_k:.1f}) confirmed overbought above adaptive threshold ({overbought_limit:.1f}).")
        elif stoch_k >= 65:
            score += 10
            reasons.append(f"StochRSI %K ({stoch_k:.1f}) in high distribution territory.")
        elif stoch_k <= 30:
            score -= 25
            warnings.append(f"Caution: StochRSI is already depressed ({stoch_k:.1f}). Selling here risks short squeeze.")

        if stoch_k < stoch_d:
            score += 10
            reasons.append("Bearish momentum cross: %K leads %D downward.")
        else:
            score -= 10
            warnings.append("%K has not yet crossed below %D.")

    # 3. Multi-Timeframe Alignment
    if is_buy:
        if mtf_bias == "BULLISH":
            score += 20
            reasons.append("MTF macro trend (Daily + 4H) aligns perfectly with BUY bias.")
        elif mtf_bias == "BEARISH":
            score -= 30
            warnings.append("Counter-trend conflict: MTF macro bias is BEARISH. Higher timeframe resistance overhead.")
        else:
            reasons.append("MTF macro trend is neutral/mixed.")

    elif is_sell:
        if mtf_bias == "BEARISH":
            score += 20
            reasons.append("MTF macro trend (Daily + 4H) aligns perfectly with SELL bias.")
        elif mtf_bias == "BULLISH":
            score -= 30
            warnings.append("Counter-trend conflict: MTF macro bias is BULLISH. Strong underlying momentum.")
        else:
            reasons.append("MTF macro trend is neutral/mixed.")

    # 4. Heikin Ashi Candlestick Reversal
    if ha_direction:
        if (is_buy and ha_direction == "BUY") or (is_sell and ha_direction == "SELL"):
            score += 15
            reasons.append(f"Candlestick confirmation: {ha_pattern_name}.")
        else:
            score -= 15
            warnings.append(f"Candlestick divergence: {ha_pattern_name} opposes signal direction.")

    # 5. PCA Statistical Arbitrage Factor Confluence
    if statarb_z is not None:
        if is_buy:
            if statarb_z <= -1.5:
                score += 20
                reasons.append(f"PCA Stat-Arb: Residual Z-Score ({statarb_z:.2f}) confirms deep statistical discount vs factor model.")
            elif statarb_z >= 1.5:
                score -= 25
                warnings.append(f"PCA Stat-Arb Conflict: Stock is statistically overextended (Z = +{statarb_z:.2f}) vs PCA peer factors.")
        elif is_sell:
            if statarb_z >= 1.5:
                score += 20
                reasons.append(f"PCA Stat-Arb: Residual Z-Score (+{statarb_z:.2f}) confirms extreme factor overvaluation for short reversion.")
            elif statarb_z <= -1.5:
                score -= 25
                warnings.append(f"PCA Stat-Arb Conflict: Stock is statistically undervalued (Z = {statarb_z:.2f}) vs PCA peer factors.")

    # Clamp confidence
    final_confidence = max(5, min(98, score))

    # Determine AI Verdict based on adaptive confidence threshold
    req_threshold = adaptive["confidence_threshold"]
    if signal == "WAIT":
        verdict = "WAIT"
        action = "No trade setup active. Preserve capital and wait for confluence."
    elif final_confidence >= req_threshold:
        verdict = "CONFIRMED"
        action = f"High probability setup confirmed under {mode} mode. Execute with standard risk allocation."
    elif final_confidence >= 50:
        verdict = "CAUTION"
        action = f"Marginal setup ({final_confidence}% confidence). If entering, reduce lot size by 50%."
    else:
        verdict = "VETOED"
        action = "AI Veto: Insufficient confluence or major trend conflict detected. Do not enter."

    # Sizing advice
    if verdict == "CONFIRMED":
        sizing = "1.0x Full Risk Allocation (1-2% account)" if mode != "DEFENSIVE_TIGHT" else "0.75x Controlled Risk Allocation"
    elif verdict == "CAUTION":
        sizing = "0.5x Half-Sized Risk Allocation"
    else:
        sizing = "0.0x Zero Capital Risked"

    return {
        "verdict": verdict,
        "confidence": final_confidence,
        "action": action,
        "sizing_advice": sizing,
        "reasons": reasons,
        "warnings": warnings,
        "adaptive_mode": mode,
        "adaptive_thresholds": {
            "stoch_oversold": oversold_limit,
            "stoch_overbought": overbought_limit,
            "min_rr": adaptive["min_rr"]
        },
        "journal_feedback": adaptive["description"]
    }
