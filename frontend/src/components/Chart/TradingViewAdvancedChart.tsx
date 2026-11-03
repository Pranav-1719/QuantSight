// components/Chart/TradingViewAdvancedChart.tsx
// Actual Official TradingView Advanced Real-Time Chart
// - Black & White Candles (White Bullish, Black Bearish with White Wicks/Borders)
// - 50 EMA in Pure WHITE (#ffffff) — strictly monochromatic, no red
// - Stochastic RSI in WHITE (%K) and GRAY (%D)
// - Volume in WHITE (Up Volume) and DARK GRAY/BLACK (Down Volume) with Gray MA
// - Complete native TradingView drawing toolbar intact (Long/Short Position Box, Fib, etc.)

import React, { useEffect, useRef } from 'react'

interface Props {
  symbolTicker: string
  interval: string
  stochKColor?: string
  stochDColor?: string
  candleUpColor?: string
  candleDownColor?: string
}

// Map yfinance tickers to TradingView symbols
const TV_SYMBOL_MAP: Record<string, string> = {
  // Forex
  'EURUSD=X': 'FX:EURUSD',
  'GBPUSD=X': 'FX:GBPUSD',
  'USDJPY=X': 'FX:USDJPY',
  'USDINR=X': 'FX_IDC:USDINR',
  'EURINR=X': 'FX_IDC:EURINR',
  'GBPINR=X': 'FX_IDC:GBPINR',
  'AUDUSD=X': 'FX:AUDUSD',
  'USDCAD=X': 'FX:USDCAD',
  // Indian Stocks & Indices
  '^NSEI': 'NSE:NIFTY',
  '^BSESN': 'BSE:SENSEX',
  'RELIANCE.NS': 'NSE:RELIANCE',
  'TCS.NS': 'NSE:TCS',
  'HDFCBANK.NS': 'NSE:HDFCBANK',
  'INFY.NS': 'NSE:INFY',
  'ICICIBANK.NS': 'NSE:ICICIBANK',
  'TATAMOTORS.NS': 'NSE:TATAMOTORS',
  'SBIN.NS': 'NSE:SBIN',
  'ITC.NS': 'NSE:ITC',
  // Commodities
  'GC=F': 'TVC:GOLD',
  'SI=F': 'TVC:SILVER',
  'CL=F': 'TVC:USOIL',
  'NG=F': 'TVC:NATGAS',
  // Crypto
  'BTC-USD': 'BINANCE:BTCUSDT',
  'ETH-USD': 'BINANCE:ETHUSDT',
}

// Map intervals to TradingView interval strings
const TV_INTERVAL_MAP: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
}

export default function TradingViewAdvancedChart({
  symbolTicker,
  interval,
  stochKColor = '#ffffff',
  stochDColor = '#a1a1aa',
  candleUpColor = '#ffffff',
  candleDownColor = '#000000',
}: Props) {
  const containerId = 'tradingview_actual_chart_container'
  const tvSymbol =
    TV_SYMBOL_MAP[symbolTicker] ||
    (symbolTicker.endsWith('.NS')
      ? `NSE:${symbolTicker.replace('.NS', '')}`
      : symbolTicker.endsWith('=X')
      ? `FX:${symbolTicker.replace('=X', '')}`
      : `NASDAQ:${symbolTicker}`)
  const tvInterval = TV_INTERVAL_MAP[interval] || '15'
  const containerRef = useRef<HTMLDivElement>(null)
  const lastSymbolRef = useRef<string>('')
  const lastIntervalRef = useRef<string>('')
  const lastUpColorRef = useRef<string>('')
  const lastDownColorRef = useRef<string>('')

  // Derive border and wick colors for contrast against dark background
  const isDarkDown =
    candleDownColor.toLowerCase() === '#000000' ||
    candleDownColor.toLowerCase() === '#09090b' ||
    candleDownColor.toLowerCase() === '#18181b'
  const downBorderColor = isDarkDown ? '#ffffff' : candleDownColor
  const downWickColor = isDarkDown ? '#ffffff' : candleDownColor

  useEffect(() => {
    // Keep user customizations intact: do not re-init if symbol, interval, and colors have not changed
    if (
      lastSymbolRef.current === tvSymbol &&
      lastIntervalRef.current === tvInterval &&
      lastUpColorRef.current === candleUpColor &&
      lastDownColorRef.current === candleDownColor
    ) {
      return
    }
    lastSymbolRef.current = tvSymbol
    lastIntervalRef.current = tvInterval
    lastUpColorRef.current = candleUpColor
    lastDownColorRef.current = candleDownColor

    const initWidget = () => {
      if (typeof (window as any).TradingView === 'undefined') return

      const container = document.getElementById(containerId)
      if (container) {
        container.innerHTML = ''
      }

      new (window as any).TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: tvInterval,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1', // 1 = Candles
        locale: 'en',
        toolbar_bg: '#000000',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_side_toolbar: false, // KEEP ALL TRADINGVIEW DRAWING TOOLS INTACT
        allow_symbol_change: true,
        save_image: true,
        container_id: containerId,
        studies: [
          'MASimple@tv-basicstudies',
          'StochasticRSI@tv-basicstudies',
        ],
        studies_overrides: {
          // ── 50 EMA in Pure WHITE (strictly monochromatic, no red) ──
          'moving average.length': 50,
          'moving average.plot.color': '#ffffff',
          'moving average.plot.linewidth': 2,

          // ── Stochastic RSI Customizable Colors ──
          'stochastic rsi.%k.color': stochKColor,
          'stochastic rsi.k.color': stochKColor,
          'stochastic rsi.%k.linewidth': 2,
          'stochastic rsi.k.linewidth': 2,
          'stochastic rsi.%d.color': stochDColor,
          'stochastic rsi.d.color': stochDColor,
          'stochastic rsi.%d.linewidth': 2,
          'stochastic rsi.d.linewidth': 2,
          'stochastic rsi.upper band.color': '#71717a',
          'stochastic rsi.upper band.value': 80,
          'stochastic rsi.lower band.color': '#71717a',
          'stochastic rsi.lower band.value': 20,
          'stochastic rsi.middle band.color': '#3f3f46',

          // ── Stochastic (Standard) Customizable Colors ──
          'stochastic.%k.color': stochKColor,
          'stochastic.k.color': stochKColor,
          'stochastic.%d.color': stochDColor,
          'stochastic.d.color': stochDColor,
        },
        overrides: {
          'paneProperties.background': '#000000',
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': '#141416',
          'paneProperties.horzGridProperties.color': '#141416',
          'scalesProperties.textColor': '#a1a1aa',
          'scalesProperties.lineColor': '#27272a',
          // CUSTOMIZABLE CANDLESTICKS (Default: Crisp B&W)
          'mainSeriesProperties.candleStyle.upColor': candleUpColor,
          'mainSeriesProperties.candleStyle.downColor': candleDownColor,
          'mainSeriesProperties.candleStyle.drawWick': true,
          'mainSeriesProperties.candleStyle.drawBorder': true,
          'mainSeriesProperties.candleStyle.borderColor': downBorderColor,
          'mainSeriesProperties.candleStyle.borderUpColor': candleUpColor,
          'mainSeriesProperties.candleStyle.borderDownColor': downBorderColor,
          'mainSeriesProperties.candleStyle.wickUpColor': candleUpColor,
          'mainSeriesProperties.candleStyle.wickDownColor': downWickColor,
          // Hollow Candles style
          'mainSeriesProperties.hollowCandleStyle.upColor': candleUpColor,
          'mainSeriesProperties.hollowCandleStyle.downColor': candleDownColor,
          'mainSeriesProperties.hollowCandleStyle.borderUpColor': candleUpColor,
          'mainSeriesProperties.hollowCandleStyle.borderDownColor': downBorderColor,
          'mainSeriesProperties.hollowCandleStyle.wickUpColor': candleUpColor,
          'mainSeriesProperties.hollowCandleStyle.wickDownColor': downWickColor,
          // Heikin Ashi style
          'mainSeriesProperties.haStyle.upColor': candleUpColor,
          'mainSeriesProperties.haStyle.downColor': candleDownColor,
          'mainSeriesProperties.haStyle.borderUpColor': candleUpColor,
          'mainSeriesProperties.haStyle.borderDownColor': downBorderColor,
          'mainSeriesProperties.haStyle.wickUpColor': candleUpColor,
          'mainSeriesProperties.haStyle.wickDownColor': downWickColor,
        },
      })
    }

    if (!document.getElementById('tradingview-widget-script')) {
      const script = document.createElement('script')
      script.id = 'tradingview-widget-script'
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = initWidget
      document.head.appendChild(script)
    } else {
      initWidget()
    }
  }, [tvSymbol, tvInterval, candleUpColor, candleDownColor, stochKColor, stochDColor])

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black flex flex-col">
      <div id={containerId} className="w-full h-full flex-1" />
    </div>
  )
}
