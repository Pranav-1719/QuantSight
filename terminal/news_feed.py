"""
news_feed.py — Multi-source RSS News Fetcher
Sources: Myfxbook, ForexFactory, Economic Times India, Moneycontrol, Yahoo Finance
Falls back gracefully when sources are unreachable.
"""

import re
import time
from datetime import datetime
from typing import Optional

import requests

# ──────────────────────────────────────────────
# RSS Feed Sources
# ──────────────────────────────────────────────
RSS_SOURCES = [
    {
        "name": "Myfxbook",
        "url": "https://www.myfxbook.com/rss/forex-economic-calendar-news",
        "tag": "🌐 FX",
        "markets": ["forex"],
    },
    {
        "name": "ForexFactory",
        "url": "https://nfs.faireconomy.media/ff_calendar_thisweek_json.json",
        "tag": "📅 FF",
        "markets": ["forex"],
        "is_json": True,
    },
    {
        "name": "Economic Times Markets",
        "url": "https://economictimes.indiatimes.com/markets/rss.cms",
        "tag": "🇮🇳 ET",
        "markets": ["stocks", "commodity"],
    },
    {
        "name": "Moneycontrol Markets",
        "url": "https://www.moneycontrol.com/rss/marketsnews.xml",
        "tag": "🇮🇳 MC",
        "markets": ["stocks", "commodity"],
    },
    {
        "name": "Yahoo Finance",
        "url": "https://finance.yahoo.com/rss/2.0/headline?s=^NSEI&region=IN&lang=en-IN",
        "tag": "📈 YF",
        "markets": ["stocks"],
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# ──────────────────────────────────────────────
# XML RSS Parser (no feedparser dependency)
# ──────────────────────────────────────────────
def _parse_rss_xml(content: str, source_name: str, tag: str) -> list[dict]:
    """Parse RSS/Atom XML and return list of news items."""
    items = []

    # Extract <item> blocks
    item_blocks = re.findall(r"<item>(.*?)</item>", content, re.DOTALL)

    for block in item_blocks[:6]:  # limit per source
        title = _extract_tag(block, "title")
        pub_date = _extract_tag(block, "pubDate") or _extract_tag(block, "dc:date")
        description = _extract_tag(block, "description")

        if not title:
            continue

        # Clean HTML from description
        desc_clean = re.sub(r"<[^>]+>", "", description or "").strip()[:150]

        items.append(
            {
                "source": source_name,
                "tag": tag,
                "title": _clean_text(title),
                "description": desc_clean,
                "time": _parse_time(pub_date),
                "raw_time": pub_date or "",
            }
        )

    return items


def _extract_tag(text: str, tag: str) -> str:
    """Extract content from an XML tag."""
    match = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", text, re.DOTALL | re.IGNORECASE)
    if match:
        content = match.group(1).strip()
        # Remove CDATA wrapper
        content = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", content, flags=re.DOTALL)
        return content.strip()
    return ""


def _clean_text(text: str) -> str:
    """Remove HTML entities and tags from text."""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    return text.strip()


def _parse_time(time_str: Optional[str]) -> str:
    """Convert RSS time string to readable format."""
    if not time_str:
        return datetime.now().strftime("%H:%M")
    try:
        # Try common RSS date formats
        for fmt in [
            "%a, %d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S GMT",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
        ]:
            try:
                dt = datetime.strptime(time_str.strip(), fmt)
                return dt.strftime("%d %b %H:%M")
            except ValueError:
                continue
    except Exception:
        pass
    return datetime.now().strftime("%H:%M")


# ──────────────────────────────────────────────
# ForexFactory JSON Parser
# ──────────────────────────────────────────────
def _parse_ff_json(data: list, tag: str) -> list[dict]:
    """Parse ForexFactory calendar JSON into news items."""
    items = []
    for event in data[:8]:
        impact = event.get("impact", "").strip()
        impact_icon = {"High": "🔴", "Medium": "🟡", "Low": "⚪"}.get(impact, "⚪")
        title = f"{impact_icon} [{event.get('currency', '')}] {event.get('title', '')}"
        items.append(
            {
                "source": "ForexFactory",
                "tag": tag,
                "title": title,
                "description": f"Forecast: {event.get('forecast', 'N/A')} | Previous: {event.get('previous', 'N/A')}",
                "time": event.get("date", ""),
                "raw_time": event.get("date", ""),
            }
        )
    return items


# ──────────────────────────────────────────────
# Fetch Single Source
# ──────────────────────────────────────────────
def _fetch_source(source: dict, timeout: int = 6) -> list[dict]:
    """Fetch and parse a single news source. Returns [] on failure."""
    try:
        resp = requests.get(source["url"], headers=HEADERS, timeout=timeout)
        resp.raise_for_status()

        if source.get("is_json"):
            return _parse_ff_json(resp.json(), source["tag"])
        else:
            return _parse_rss_xml(resp.text, source["name"], source["tag"])

    except Exception:
        return []


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────
def fetch_news(market_filter: Optional[list[str]] = None, max_items: int = 20) -> list[dict]:
    """
    Fetch news from all available sources.

    Args:
        market_filter: list of markets to include e.g. ['forex', 'stocks', 'commodity']
        max_items: maximum total news items to return

    Returns:
        List of news dicts with keys: source, tag, title, description, time
    """
    all_news: list[dict] = []

    for source in RSS_SOURCES:
        # Apply market filter if specified
        if market_filter:
            if not any(m in source.get("markets", []) for m in market_filter):
                continue

        items = _fetch_source(source)
        all_news.extend(items)

    # Sort by raw_time descending (latest first), fall back to insertion order
    try:
        all_news.sort(key=lambda x: x.get("raw_time", ""), reverse=True)
    except Exception:
        pass

    return all_news[:max_items]


def get_impact_badge(title: str) -> str:
    """Return a colour-coded impact badge based on keywords in title."""
    title_lower = title.lower()
    if any(w in title_lower for w in ["nfp", "fomc", "rate decision", "cpi", "gdp", "rbi", "fed"]):
        return "🔴 HIGH"
    elif any(w in title_lower for w in ["pmi", "retail", "employment", "trade", "earnings"]):
        return "🟡 MED"
    else:
        return "⚪ LOW"
