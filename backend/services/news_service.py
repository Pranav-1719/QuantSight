"""
services/news_service.py — Multi-source RSS News Fetcher (no external library)
"""

import re
import time
from datetime import datetime
from typing import Optional

import requests

RSS_SOURCES = [
    {"name": "Myfxbook",       "url": "https://www.myfxbook.com/rss/forex-economic-calendar-news", "tag": "FX"},
    {"name": "CoinDesk",       "url": "https://www.coindesk.com/arc/outboundfeeds/rss/",             "tag": "CRYPTO"},
    {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/markets/rss.cms",        "tag": "IN"},
    {"name": "Moneycontrol",   "url": "https://www.moneycontrol.com/rss/marketsnews.xml",            "tag": "IN"},
    {"name": "Yahoo Finance",  "url": "https://finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN","tag": "NSE"},
    {"name": "ForexLive",      "url": "https://www.forexlive.com/feed/news",                         "tag": "FX"},
]

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
HIGH_IMPACT_KW = ["rbi", "fed", "fomc", "rate decision", "nfp", "cpi", "gdp", "inflation", "interest rate", "sec", "halving", "etf approval"]
MED_IMPACT_KW  = ["pmi", "retail", "employment", "trade", "earnings", "results", "deficit", "bitcoin", "ethereum", "crypto", "liquidation"]

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
    for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT", "%Y-%m-%dT%H:%M:%S%z"]:
        try:
            return datetime.strptime(s.strip(), fmt).strftime("%d %b %H:%M")
        except:
            pass
    return datetime.now().strftime("%H:%M")


def _impact(title: str) -> str:
    t = title.lower()
    if any(k in t for k in HIGH_IMPACT_KW): return "HIGH"
    if any(k in t for k in MED_IMPACT_KW):  return "MED"
    return "LOW"


def _fetch_source(source: dict) -> list[dict]:
    try:
        r = requests.get(source["url"], headers=HEADERS, timeout=6)
        r.raise_for_status()
        items = []
        for block in re.findall(r"<item>(.*?)</item>", r.text, re.DOTALL)[:8]:
            title = _extract(block, "title")
            if not title:
                continue
            items.append({
                "source": source["name"],
                "tag":    source["tag"],
                "title":  title,
                "desc":   _extract(block, "description")[:120],
                "time":   _parse_time(_extract(block, "pubDate")),
                "impact": _impact(title),
            })
        return items
    except:
        return []


def fetch_news(max_items: int = 25) -> list[dict]:
    now = time.time()
    if _cache["data"] and (now - _cache["fetched_at"]) < 300:
        return _cache["data"][:max_items]

    all_news = []
    for src in RSS_SOURCES:
        all_news.extend(_fetch_source(src))

    _cache["data"] = all_news
    _cache["fetched_at"] = now
    return all_news[:max_items]
