"""
services/news_service.py — Multi-source RSS News Fetcher with Currency Classification & Impact Scoring
"""

import re
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

import requests

RSS_SOURCES = [
    {"name": "ForexLive",      "url": "https://www.forexlive.com/feed/news",                         "tag": "FX"},
    {"name": "Myfxbook",       "url": "https://www.myfxbook.com/rss/forex-economic-calendar-news", "tag": "FX"},
    {"name": "FXStreet",       "url": "https://www.fxstreet.com/rss/news",                          "tag": "FX"},
    {"name": "CoinDesk",       "url": "https://www.coindesk.com/arc/outboundfeeds/rss/",             "tag": "CRYPTO"},
    {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/markets/rss.cms",        "tag": "IN"},
    {"name": "Moneycontrol",   "url": "https://www.moneycontrol.com/rss/marketsnews.xml",            "tag": "IN"},
    {"name": "Yahoo Finance",  "url": "https://finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN","tag": "NSE"},
]

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

HIGH_IMPACT_KW = [
    "rbi", "fed", "fomc", "rate decision", "nfp", "nonfarm", "cpi", "gdp", "inflation", 
    "interest rate", "sec", "halving", "etf approval", "boj", "ecb", "boe", "powell", 
    "lagarde", "war", "tariff", "breaking", "crisis", "default", "liquidation spike"
]

MED_IMPACT_KW = [
    "pmi", "retail", "employment", "trade balance", "earnings", "results", "deficit", 
    "bitcoin", "ethereum", "crypto", "yield", "treasury", "crude", "opec", "jobs", "housing"
]

CURRENCY_KEYWORDS = {
    "USD": ["usd", "dollar", "fed", "fomc", "powell", "treasury", "greenback", "wall st", "u.s.", "us economy", "nfp", "yields"],
    "JPY": ["jpy", "yen", "japan", "boj", "bank of japan", "ueda", "tokyo", "nikkei", "intervention"],
    "EUR": ["eur", "euro", "ecb", "lagarde", "eurozone", "germany", "bund", "france"],
    "GBP": ["gbp", "pound", "sterling", "boe", "bank of england", "bailey", "uk ", "britain", "gilts"],
    "INR": ["inr", "rupee", "rbi", "nifty", "sensex", "india", "sebi", "dalal", "shaktikanta", "mumbai"],
    "BTC": ["btc", "bitcoin", "eth", "ethereum", "crypto", "binance", "coinbase", "halving", "solana", "altcoin"],
    "COMMODITY": ["gold", "silver", "crude", "oil", "brent", "wti", "opec", "natural gas", "xau", "xag", "copper"],
}

_cache: dict = {"data": [], "fetched_at": 0}


def _extract(text: str, tag: str) -> str:
    m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", text, re.DOTALL | re.IGNORECASE)
    if not m:
        return ""
    content = m.group(1).strip()
    content = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", content, flags=re.DOTALL)
    return re.sub(r"<[^>]+>", "", content).replace("&amp;","&").replace("&lt;","<").replace("&gt;",">").replace("&nbsp;"," ").strip()


def _parse_time(s: str) -> str:
    if not s:
        return datetime.now().strftime("%H:%M")
    for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"]:
        try:
            return datetime.strptime(s.strip(), fmt).strftime("%d %b %H:%M")
        except:
            pass
    return datetime.now().strftime("%H:%M")


def _impact(text: str) -> str:
    t = text.lower()
    if any(k in t for k in HIGH_IMPACT_KW): 
        return "HIGH"
    if any(k in t for k in MED_IMPACT_KW):  
        return "MED"
    return "LOW"


def _detect_currencies(title: str, desc: str, source_tag: str) -> tuple[str, List[str]]:
    combined = f"{title} {desc}".lower()
    detected = []
    for curr, kws in CURRENCY_KEYWORDS.items():
        for kw in kws:
            # Word boundary matching or simple contains
            pattern = rf"\b{re.escape(kw)}\b" if len(kw) <= 4 else re.escape(kw)
            if re.search(pattern, combined):
                detected.append(curr)
                break

    if not detected:
        if source_tag == "IN" or source_tag == "NSE":
            detected = ["INR"]
        elif source_tag == "CRYPTO":
            detected = ["BTC"]
        elif source_tag == "FX":
            detected = ["USD"]
        else:
            detected = ["GLOBAL"]

    primary = detected[0]
    return primary, detected


def _fetch_source(source: dict) -> list[dict]:
    try:
        r = requests.get(source["url"], headers=HEADERS, timeout=6)
        r.raise_for_status()
        items = []
        for block in re.findall(r"<item>(.*?)</item>", r.text, re.DOTALL)[:10]:
            title = _extract(block, "title")
            if not title:
                continue
            desc = _extract(block, "description")[:140]
            time_str = _parse_time(_extract(block, "pubDate"))
            impact = _impact(f"{title} {desc}")
            primary_curr, all_currs = _detect_currencies(title, desc, source["tag"])

            items.append({
                "source": source["name"],
                "tag": source["tag"],
                "title": title,
                "desc": desc,
                "time": time_str,
                "impact": impact,
                "currency": primary_curr,
                "currencies": all_currs,
            })
        return items
    except Exception:
        return []


def fetch_news(max_items: int = 50) -> list[dict]:
    now = time.time()
    if _cache["data"] and (now - _cache["fetched_at"]) < 120:
        return _cache["data"][:max_items]

    all_news = []
    for src in RSS_SOURCES:
        all_news.extend(_fetch_source(src))

    if not all_news and _cache["data"]:
        return _cache["data"][:max_items]

    # De-duplicate by title
    seen = set()
    unique_news = []
    for item in all_news:
        clean_title = item["title"].lower().strip()
        if clean_title not in seen:
            seen.add(clean_title)
            unique_news.append(item)

    _cache["data"] = unique_news
    _cache["fetched_at"] = now
    return unique_news[:max_items]
