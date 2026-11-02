"""
services/pca_statarb_service.py — Exact QuantConnect PCA Statistical Arbitrage Algorithm
Faithful implementation of PcaStatArbitrageAlgorithm (QCAlgorithm by Daniel Chen):
- 60-day rolling lookback of daily closes across liquid universe
- Demeaned log-prices: sample = np.log(history) - mean
- sklearn.decomposition.PCA for extracting top 3 statistical factors
- statsmodels.api OLS regression for factor decomposition and residual isolation
- Standardized residual z-scores: z < -1.5 triggers mean-reversion rebalance targets
- Computes exact normalized portfolio target weights with cash buffer
"""

import numpy as np
import pandas as pd
import yfinance as yf
import statsmodels.api as sm
from sklearn.decomposition import PCA
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

# Default universes matching QuantConnect dollar-volume liquid universe
UNIVERSES = {
    "US_Top20": [
        "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "V", "XOM",
        "JNJ", "MA", "HD", "PG", "COST", "ABBV", "BAC", "CRM", "AMD", "NFLX"
    ],
    "India_Top": [
        "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "LT.NS", "WIPRO.NS", "TATAMOTORS.NS", "KOTAKBANK.NS"
    ],
    "Forex": [
        "EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDCAD=X", "USDINR=X", "EURINR=X", "GBPINR=X"
    ],
    "Crypto": [
        "BTC-USD", "ETH-USD"
    ]
}

def _get_universe_for_symbol(symbol: str) -> List[str]:
    """Finds which universe group the given symbol belongs to."""
    for cat, symbols in UNIVERSES.items():
        if symbol in symbols:
            return symbols
    if symbol.endswith(".NS"):
        return UNIVERSES["India_Top"]
    elif symbol.endswith("=X"):
        return UNIVERSES["Forex"]
    elif symbol.endswith("-USD"):
        return UNIVERSES["Crypto"]
    else:
        return UNIVERSES["US_Top20"]

def run_pca_statarb_algorithm(
    universe_name: str = "US_Top20",
    lookback_days: int = 60,
    pca_components: int = 3,
    entry_z_score: float = -1.5,
    free_portfolio_value_percentage: float = 0.05,
    custom_symbols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Exact implementation of PcaStatArbitrageAlgorithm._compute_weights_by_symbol(symbols):

    1. history = self.history(symbols, self._lookback_days, Resolution.DAILY).close.unstack(0)
    2. sample = np.log(history.dropna(axis=1))
    3. sample = sample - sample.mean()
    4. pca_model = PCA().fit(sample)
    5. factors = np.dot(sample, pca_model.components_.T)[:, :self._pca_components]
    6. factors = sm.add_constant(factors)
    7. ols_models = {symbol: sm.OLS(sample[symbol], factors).fit() for symbol in sample.columns}
    8. residuals = pd.DataFrame({symbol: model.resid for symbol, model in ols_models.items()}, index=sample.index)
    9. z_scores = ((residuals - residuals.mean()) / residuals.std()).iloc[-1]
    10. selected_scores = z_scores[z_scores < self._entry_z_score]
    11. denominator = selected_scores.abs().sum()
    12. return selected_scores * (1 / denominator)
    """
    symbols = custom_symbols if custom_symbols else UNIVERSES.get(universe_name, UNIVERSES["US_Top20"])
    if not symbols or len(symbols) < 2:
        return {"success": False, "error": "Universe must contain at least 2 assets."}

    # Download daily history for universe
    fetch_days = max(lookback_days + 30, 90)
    try:
        raw = yf.download(
            symbols,
            period=f"{fetch_days}d",
            interval="1d",
            auto_adjust=True,
            progress=False
        )
    except Exception as e:
        return {"success": False, "error": f"Failed to download universe history: {str(e)}"}

    if raw is None or raw.empty:
        return {"success": False, "error": "No price history returned for universe."}

    # Extract Close prices
    if "Close" in raw:
        history = raw["Close"]
    else:
        history = raw

    if isinstance(history, pd.Series):
        history = history.to_frame()

    # Drop missing columns and align to lookback_days
    history = history.dropna(axis=1, how="all").dropna().tail(lookback_days)
    if len(history) < 20 or len(history.columns) < 2:
        return {"success": False, "error": f"Insufficient historical bars ({len(history)}) for 60-day PCA."}

    valid_symbols = list(history.columns)
    effective_k = min(pca_components, len(valid_symbols) - 1, len(history) - 2)
    if effective_k < 1:
        effective_k = 1

    # Step 1 & 2: Log transform & column-wise demeaning
    log_history = np.log(history.astype(float))
    mean_log_prices = log_history.mean()
    sample = log_history - mean_log_prices

    # Step 3: Fit PCA
    pca_model = PCA().fit(sample)

    # Step 4: Extract first n factors
    factors = np.dot(sample, pca_model.components_.T)[:, :effective_k]

    # Step 5: Add constant (intercept) for statsmodels OLS
    factors_with_const = sm.add_constant(factors)

    # Step 6: Train OLS regression for each symbol
    ols_models = {}
    ols_r2 = {}
    ols_betas = {}
    fair_prices = {}

    for symbol in sample.columns:
        model = sm.OLS(sample[symbol], factors_with_const).fit()
        ols_models[symbol] = model
        ols_r2[symbol] = round(float(model.rsquared), 4)
        ols_betas[symbol] = [round(float(b), 4) for b in model.params]

        # Latest predicted demeaned price + mean -> exponentiate to get fair price
        latest_pred_demeaned = float(model.fittedvalues.iloc[-1])
        latest_fair_log = latest_pred_demeaned + mean_log_prices[symbol]
        fair_prices[symbol] = float(np.exp(latest_fair_log))

    # Step 7: Get residuals from linear regression
    residuals = pd.DataFrame(
        {symbol: model.resid for symbol, model in ols_models.items()},
        index=sample.index
    )

    # Step 8: Standardized Z-Scores of residuals from most recent day
    resid_means = residuals.mean()
    resid_stds = residuals.std().replace(0, 1e-6)
    z_scores = ((residuals - resid_means) / resid_stds).iloc[-1]

    # Step 9: Select stocks with z-scores below entry_z_score (-1.5)
    selected_scores = z_scores[z_scores < entry_z_score]
    denominator = selected_scores.abs().sum()

    # Step 10: Compute weights
    investable_capital_multiplier = 1.0 - free_portfolio_value_percentage  # e.g. 0.95 (95% invested, 5% cash)
    weight_by_symbol = {}
    target_portfolio_positions = []

    if denominator > 0 and len(selected_scores) > 0:
        raw_weights = selected_scores * (1.0 / denominator)  # negative weights
        for symbol, raw_w in raw_weights.items():
            # In QC: PortfolioTarget(symbol, -weight) where weight is negative -> -(-w) = +w (LONG)
            long_weight = abs(float(raw_w)) * investable_capital_multiplier
            weight_by_symbol[symbol] = round(long_weight, 4)

            curr_p = float(history[symbol].iloc[-1])
            fair_p = fair_prices[symbol]
            target_portfolio_positions.append({
                "symbol": symbol,
                "z_score": round(float(selected_scores[symbol]), 3),
                "target_weight_pct": round(long_weight * 100, 2),
                "current_price": round(curr_p, 4),
                "fair_price": round(fair_p, 4),
                "expected_return_pct": round((fair_p - curr_p) / curr_p * 100, 2),
                "r2_fit": ols_r2.get(symbol, 0.0),
                "action": "BUY_LONG",
                "trade_call": f"BUY {symbol} (Target Weight: {round(long_weight * 100, 1)}%) | Residual Z: {round(float(selected_scores[symbol]), 2)} < {entry_z_score}"
            })

    # Also calculate overvalued stocks (z > +1.5) for two-sided mean reversion shorts
    short_selected = z_scores[z_scores > abs(entry_z_score)]
    short_positions = []
    if len(short_selected) > 0:
        s_denom = short_selected.sum()
        for symbol, s_val in short_selected.items():
            s_weight = (s_val / s_denom) * investable_capital_multiplier if s_denom > 0 else 0
            curr_p = float(history[symbol].iloc[-1])
            fair_p = fair_prices[symbol]
            short_positions.append({
                "symbol": symbol,
                "z_score": round(float(s_val), 3),
                "target_weight_pct": round(s_weight * 100, 2),
                "current_price": round(curr_p, 4),
                "fair_price": round(fair_p, 4),
                "expected_return_pct": round((fair_p - curr_p) / curr_p * 100, 2),
                "action": "SELL_SHORT",
                "trade_call": f"SHORT {symbol} | Residual Z: +{round(float(s_val), 2)} > +{abs(entry_z_score)}"
            })

    # Full universe rankings sorted by z-score
    universe_rankings = []
    for sym in valid_symbols:
        z = float(z_scores[sym])
        curr_p = float(history[sym].iloc[-1])
        fair_p = fair_prices[sym]
        dist_pct = (fair_p - curr_p) / curr_p * 100

        if z < entry_z_score:
            status = "SIGNAL_BUY"
        elif z > abs(entry_z_score):
            status = "SIGNAL_SHORT"
        else:
            status = "NEUTRAL"

        universe_rankings.append({
            "symbol": sym,
            "z_score": round(z, 3),
            "status": status,
            "current_price": round(curr_p, 4),
            "fair_price": round(fair_p, 4),
            "deviation_pct": round(dist_pct, 2),
            "r2_fit": ols_r2.get(sym, 0.0),
            "target_weight_pct": round(weight_by_symbol.get(sym, 0.0) * 100, 2)
        })

    # Sort rankings: most negative z-score first (strongest buy candidates)
    universe_rankings.sort(key=lambda x: x["z_score"])

    # Variance explained by top PCA factors
    factor_variance = [round(float(v) * 100, 2) for v in pca_model.explained_variance_ratio_[:effective_k]]

    return {
        "success": True,
        "algorithm": "QuantConnect PcaStatArbitrageAlgorithm",
        "universe_name": universe_name,
        "lookback_days": lookback_days,
        "pca_components": effective_k,
        "entry_z_score": entry_z_score,
        "free_cash_buffer_pct": round(free_portfolio_value_percentage * 100, 1),
        "total_variance_explained": round(sum(factor_variance), 2),
        "factor_variance_ratios": factor_variance,
        "triggered_count": len(target_portfolio_positions),
        "portfolio_targets": target_portfolio_positions,
        "short_targets": short_positions,
        "universe_rankings": universe_rankings,
        "rebalance_cadence": "Monthly Scheduled (Next Month Start at 08:00)",
        "evaluated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


def get_statarb_for_single_symbol(symbol: str) -> Dict[str, Any]:
    """Evaluates a single symbol against its natural PCA peer universe."""
    universe_symbols = _get_universe_for_symbol(symbol)
    result = run_pca_statarb_algorithm(custom_symbols=universe_symbols)
    if not result.get("success"):
        return result

    symbol_data = None
    for r in result.get("universe_rankings", []):
        if r["symbol"] == symbol:
            symbol_data = r
            break

    if not symbol_data and result.get("universe_rankings"):
        symbol_data = result["universe_rankings"][0]

    return {
        "success": True,
        "symbol_data": symbol_data,
        "portfolio_target": next((p for p in result.get("portfolio_targets", []) if p["symbol"] == symbol), None),
        "universe_context": {
            "total_variance_explained": result.get("total_variance_explained"),
            "factor_variance_ratios": result.get("factor_variance_ratios"),
            "pca_components": result.get("pca_components"),
            "entry_z_score": result.get("entry_z_score"),
            "triggered_count": result.get("triggered_count")
        }
    }
