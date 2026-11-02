"""
backend/main.py — QuantSight Trading Terminal API
FastAPI backend: OHLCV data, strategy signals, live price WebSocket, news feed
"""

import asyncio
import json
import os
import sys
import time as time_module
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import yfinance as yf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from services.data_service import fetch_ohlcv, get_live_price
    from services.strategy_service import analyze_full_strategy, analyze_mtf
    from services.news_service import fetch_news
    from services.journal_service import log_trade, update_trade, delete_trade, get_all_trades, get_journal_stats, get_trade_by_id
    from services.ai_adaptive_service import get_adaptive_parameters, confirm_decision
    from services.pca_statarb_service import run_pca_statarb_algorithm, get_statarb_for_single_symbol, UNIVERSES
except ImportError:
    from backend.services.data_service import fetch_ohlcv, get_live_price
    from backend.services.strategy_service import analyze_full_strategy, analyze_mtf
    from backend.services.news_service import fetch_news
    from backend.services.journal_service import log_trade, update_trade, delete_trade, get_all_trades, get_journal_stats, get_trade_by_id
    from backend.services.ai_adaptive_service import get_adaptive_parameters, confirm_decision
    from backend.services.pca_statarb_service import run_pca_statarb_algorithm, get_statarb_for_single_symbol, UNIVERSES

class TradeCreateSchema(BaseModel):
    symbol: str
    direction: str
    entry_price: float
    sl_price: float
    tp_price: float
    rr_ratio: float
    lot_size: Optional[float] = 1.0
    ai_verdict: Optional[str] = None
    ai_confidence: Optional[float] = None
    strategy_notes: Optional[str] = None

class TradeUpdateSchema(BaseModel):
    exit_price: Optional[float] = None
    status: Optional[str] = None
    pnl: Optional[float] = None
    strategy_notes: Optional[str] = None
    lot_size: Optional[float] = None

# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[QuantSight Terminal API] starting on port 8000...")
    yield
    print("[QuantSight Terminal API] stopped.")

app = FastAPI(title="QuantSight Terminal API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# REST Routes
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/ohlcv")
async def get_ohlcv(
    symbol: str = Query(..., description="yfinance ticker e.g. EURUSD=X"),
    interval: str = Query("1d", description="1m,5m,15m,1h,4h,1d,1wk"),
    period: str = Query("6mo", description="7d,1mo,3mo,6mo,1y,2y"),
):
    """Returns OHLCV candles + EMA50 + StochRSI for the chart."""
    try:
        data = fetch_ohlcv(symbol, period, interval)
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.get("/api/strategy")
async def get_strategy(
    symbol: str = Query(...),
    interval: str = Query("15m"),
    period: str = Query("7d"),
):
    """
    Returns full strategy analysis: signal, entry/SL/TP, logic, MTF breakdown.
    """
    try:
        result = analyze_full_strategy(symbol, period, interval)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.get("/api/mtf")
async def get_mtf(symbol: str = Query(...)):
    """Multi-timeframe analysis: Daily, 4H, 1H, 15m."""
    try:
        result = analyze_mtf(symbol)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.get("/api/news")
async def get_news(limit: int = Query(20)):
    """Fetch latest news from RSS sources."""
    try:
        items = fetch_news(max_items=limit)
        return {"success": True, "data": items}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}


@app.get("/api/price/{symbol:path}")
async def get_price(symbol: str):
    """Get latest price snapshot for a symbol."""
    try:
        price_data = get_live_price(symbol)
        return {"success": True, "data": price_data}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


# ──────────────────────────────────────────────
# Trading Journal Endpoints
# ──────────────────────────────────────────────

@app.get("/api/journal")
async def list_journal_trades(status: Optional[str] = Query(None)):
    """Retrieve all journaled trades with optional status filter."""
    try:
        trades = get_all_trades(status=status)
        return {"success": True, "data": trades}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}


@app.post("/api/journal")
async def create_journal_trade(trade: TradeCreateSchema):
    """Log a new trade into the persistent trading journal."""
    try:
        new_trade = log_trade(
            symbol=trade.symbol,
            direction=trade.direction,
            entry_price=trade.entry_price,
            sl_price=trade.sl_price,
            tp_price=trade.tp_price,
            rr_ratio=trade.rr_ratio,
            lot_size=trade.lot_size or 1.0,
            ai_verdict=trade.ai_verdict,
            ai_confidence=trade.ai_confidence,
            strategy_notes=trade.strategy_notes,
        )
        return {"success": True, "data": new_trade}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.put("/api/journal/{trade_id}")
async def update_journal_trade(trade_id: int, payload: TradeUpdateSchema):
    """Update or close a trade (e.g. exit_price, status WON/LOST, notes)."""
    try:
        updates = {k: v for k, v in payload.dict().items() if v is not None}
        updated = update_trade(trade_id, updates)
        if not updated:
            raise HTTPException(status_code=404, detail="Trade not found")
        return {"success": True, "data": updated}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


@app.delete("/api/journal/{trade_id}")
async def remove_journal_trade(trade_id: int):
    """Delete a trade from the journal."""
    try:
        deleted = delete_trade(trade_id)
        return {"success": True, "deleted": deleted}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/journal/stats")
async def get_stats():
    """Retrieve win-rate, profit-factor, and journal performance metrics."""
    try:
        stats = get_journal_stats()
        return {"success": True, "data": stats}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


# ──────────────────────────────────────────────
# AI Adaptive Strategy & Confirmation Endpoints
# ──────────────────────────────────────────────

@app.get("/api/ai/adaptive-params")
async def get_adaptive_params():
    """Retrieve current AI adaptive strategy thresholds based on journal metrics."""
    try:
        params = get_adaptive_parameters()
        return {"success": True, "data": params}
    except Exception as e:
        return {"success": False, "error": str(e), "data": None}


# ──────────────────────────────────────────────
# PCA Statistical Arbitrage Endpoints
# ──────────────────────────────────────────────

@app.get("/api/statarb/universe")
async def get_statarb_universe(category: str = Query("US_Top20")):
    """
    Run exact QuantConnect PCA Statistical Arbitrage Algorithm on a preset universe
    (US_Top20, India_Top, Forex, Crypto).
    """
    try:
        result = run_pca_statarb_algorithm(universe_name=category)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/statarb/symbol/{symbol:path}")
async def get_statarb_symbol(symbol: str):
    """
    Run PCA Stat-Arb for a specific symbol against its peer basket.
    """
    try:
        result = get_statarb_for_single_symbol(symbol)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


# ──────────────────────────────────────────────
# WebSocket — Live Price Stream
# ──────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, symbol: str, ws: WebSocket):
        await ws.accept()
        if symbol not in self.active:
            self.active[symbol] = []
        self.active[symbol].append(ws)

    def disconnect(self, symbol: str, ws: WebSocket):
        if symbol in self.active:
            self.active[symbol].discard(ws) if hasattr(self.active[symbol], 'discard') else None
            try:
                self.active[symbol].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, symbol: str, data: dict):
        if symbol not in self.active:
            return
        dead = []
        for ws in self.active[symbol]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(symbol, ws)


manager = ConnectionManager()


@app.websocket("/ws/price/{symbol:path}")
async def websocket_price(websocket: WebSocket, symbol: str):
    """Push live price updates every 2 seconds."""
    await manager.connect(symbol, websocket)
    prev_price = None
    try:
        while True:
            try:
                price_data = get_live_price(symbol)
                if price_data and price_data.get("price") != prev_price:
                    prev_price = price_data.get("price")
                    await websocket.send_json(price_data)
            except Exception:
                pass
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(symbol, websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
