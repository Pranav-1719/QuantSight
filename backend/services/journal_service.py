"""
services/journal_service.py — SQLite Trading Journal Storage & Performance Metrics
Manages persistent trade records, execution tracking, and win-rate statistics.
"""

import sqlite3
import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "trades.db"

def _get_connection():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize trades table with required schema."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            direction TEXT NOT NULL,
            entry_price REAL NOT NULL,
            sl_price REAL NOT NULL,
            tp_price REAL NOT NULL,
            exit_price REAL,
            lot_size REAL DEFAULT 1.0,
            status TEXT NOT NULL DEFAULT 'OPEN',
            pnl REAL DEFAULT 0.0,
            rr_ratio REAL NOT NULL,
            ai_verdict TEXT,
            ai_confidence REAL,
            strategy_notes TEXT,
            created_at INTEGER NOT NULL,
            closed_at INTEGER
        )
    """)
    conn.commit()
    conn.close()

# Initialize immediately on import
init_db()

def log_trade(
    symbol: str,
    direction: str,
    entry_price: float,
    sl_price: float,
    tp_price: float,
    rr_ratio: float,
    lot_size: float = 1.0,
    ai_verdict: Optional[str] = None,
    ai_confidence: Optional[float] = None,
    strategy_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new trade log record."""
    conn = _get_connection()
    cursor = conn.cursor()
    now = int(time.time())

    cursor.execute("""
        INSERT INTO trades (
            symbol, direction, entry_price, sl_price, tp_price,
            lot_size, status, pnl, rr_ratio, ai_verdict,
            ai_confidence, strategy_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', 0.0, ?, ?, ?, ?, ?)
    """, (
        symbol, direction.upper(), float(entry_price), float(sl_price), float(tp_price),
        float(lot_size), float(rr_ratio), ai_verdict,
        float(ai_confidence) if ai_confidence is not None else None,
        strategy_notes, now
    ))
    trade_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_trade_by_id(trade_id)

def update_trade(trade_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update trade fields (e.g., closing with exit_price and status)."""
    conn = _get_connection()
    cursor = conn.cursor()

    existing = cursor.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
    if not existing:
        conn.close()
        return None

    entry_price = existing["entry_price"]
    direction = existing["direction"]
    lot_size = existing["lot_size"]

    # Calculate P&L if closing
    if "exit_price" in updates and updates["exit_price"] is not None:
        exit_p = float(updates["exit_price"])
        if direction == "BUY":
            pnl = (exit_p - entry_price) * lot_size
        else:
            pnl = (entry_price - exit_p) * lot_size
        updates["pnl"] = round(pnl, 2)
        if "status" not in updates:
            if pnl > 0:
                updates["status"] = "WON"
            elif pnl < 0:
                updates["status"] = "LOST"
            else:
                updates["status"] = "BE"
        updates["closed_at"] = int(time.time())

    fields = []
    values = []
    for k, v in updates.items():
        if k in ("status", "exit_price", "pnl", "strategy_notes", "closed_at", "lot_size"):
            fields.append(f"{k} = ?")
            values.append(v)

    if fields:
        values.append(trade_id)
        cursor.execute(f"UPDATE trades SET {', '.join(fields)} WHERE id = ?", tuple(values))
        conn.commit()

    conn.close()
    return get_trade_by_id(trade_id)

def delete_trade(trade_id: int) -> bool:
    """Delete a trade by ID."""
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_trade_by_id(trade_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single trade by ID."""
    conn = _get_connection()
    row = conn.cursor().execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_trades(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all trades, optionally filtered by status (OPEN, WON, LOST, BE)."""
    conn = _get_connection()
    cursor = conn.cursor()
    if status and status.upper() != "ALL":
        rows = cursor.execute("SELECT * FROM trades WHERE status = ? ORDER BY id DESC", (status.upper(),)).fetchall()
    else:
        rows = cursor.execute("SELECT * FROM trades ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_journal_stats() -> Dict[str, Any]:
    """Calculate overall performance metrics for the trading journal."""
    conn = _get_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM trades ORDER BY id ASC").fetchall()
    conn.close()

    total_trades = len(rows)
    if total_trades == 0:
        return {
            "total_trades": 0,
            "open_trades": 0,
            "closed_trades": 0,
            "win_count": 0,
            "loss_count": 0,
            "be_count": 0,
            "win_rate": 0.0,
            "total_pnl": 0.0,
            "profit_factor": 0.0,
            "avg_rr": 0.0,
            "current_streak": 0,
            "streak_type": "NONE"
        }

    open_trades = [r for r in rows if r["status"] == "OPEN"]
    closed_trades = [r for r in rows if r["status"] in ("WON", "LOST", "BE")]

    wins = [r for r in closed_trades if r["status"] == "WON"]
    losses = [r for r in closed_trades if r["status"] == "LOST"]
    bes = [r for r in closed_trades if r["status"] == "BE"]

    win_count = len(wins)
    loss_count = len(losses)
    be_count = len(bes)
    closed_count = len(closed_trades)

    win_rate = (win_count / closed_count * 100) if closed_count > 0 else 0.0

    total_pnl = sum(r["pnl"] for r in closed_trades)
    gross_profits = sum(r["pnl"] for r in wins)
    gross_losses = abs(sum(r["pnl"] for r in losses))

    profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else (99.0 if gross_profits > 0 else 0.0)

    avg_rr = sum(r["rr_ratio"] for r in rows) / total_trades if total_trades > 0 else 0.0

    # Calculate streak from closed trades
    streak = 0
    streak_type = "NONE"
    for r in reversed(closed_trades):
        if streak_type == "NONE":
            streak_type = r["status"]
            streak = 1
        elif r["status"] == streak_type:
            streak += 1
        else:
            break

    return {
        "total_trades": total_trades,
        "open_trades": len(open_trades),
        "closed_trades": closed_count,
        "win_count": win_count,
        "loss_count": loss_count,
        "be_count": be_count,
        "win_rate": round(win_rate, 1),
        "total_pnl": round(total_pnl, 2),
        "profit_factor": round(profit_factor, 2),
        "avg_rr": round(avg_rr, 2),
        "current_streak": streak,
        "streak_type": streak_type
    }
