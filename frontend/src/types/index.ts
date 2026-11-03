// types/index.ts — Shared type definitions

export type ChartType = 'candlestick' | 'heikin_ashi' | 'line'
export type Interval  = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1wk'

export interface OHLCV {
  time:   number
  open:   number
  high:   number
  low:    number
  close:  number
  volume?: number
}

export interface TimeValue {
  time:  number
  value: number
}

export interface StochPoint {
  time: number
  k:    number
  d:    number
}

export interface ChartMarker {
  time:  number
  type:  'BUY' | 'SELL'
  price: number
}

export interface OHLCVResponse {
  symbol:      string
  interval:    string
  candles:     OHLCV[]
  heikin_ashi: OHLCV[]
  ema50:       TimeValue[]
  stochrsi:    StochPoint[]
}

export type StochState = 'OVERSOLD' | 'OVERBOUGHT' | 'MIDDLE' | 'NEUTRAL' | 'UNKNOWN'
export type SignalType  =
  | 'BUY' | 'SELL'
  | 'BUY_WATCH' | 'SELL_WATCH'
  | 'TOP_UP_BUY' | 'TOP_UP_SELL'
  | 'BREAKOUT_WATCH'
  | 'WAIT' | 'NO_DATA'

export interface SignalDisplay {
  label: string
  color: string
  emoji: string
}

export interface HAPattern {
  pattern:   string
  direction: 'BUY' | 'SELL' | null
}

export interface AIConfirmation {
  verdict: 'CONFIRMED' | 'CAUTION' | 'VETOED' | 'WAIT'
  confidence: number
  action: string
  sizing_advice: string
  reasons: string[]
  warnings: string[]
  adaptive_mode: string
  adaptive_thresholds: {
    stoch_oversold: number
    stoch_overbought: number
    min_rr: number
  }
  journal_feedback: string
}

export interface AdaptiveParams {
  mode: string
  stoch_oversold: number
  stoch_overbought: number
  ema_proximity_mult: number
  min_rr: number
  sl_atr_mult: number
  tp_atr_mult: number
  confidence_threshold: number
  description: string
  win_rate: number
  closed_trades: number
  profit_factor: number
  streak: string
}

export interface JournalTrade {
  id: number
  symbol: string
  direction: 'BUY' | 'SELL'
  entry_price: number
  sl_price: number
  tp_price: number
  exit_price?: number | null
  lot_size: number
  status: 'OPEN' | 'WON' | 'LOST' | 'BE'
  pnl: number
  rr_ratio: number
  ai_verdict?: string | null
  ai_confidence?: number | null
  strategy_notes?: string | null
  created_at: number
  closed_at?: number | null
}

export interface JournalStats {
  total_trades: number
  open_trades: number
  closed_trades: number
  win_count: number
  loss_count: number
  be_count: number
  win_rate: number
  total_pnl: number
  profit_factor: number
  avg_rr: number
  current_streak: number
  streak_type: string
}

export interface StatArbItem {
  symbol: string
  current_price: number
  fair_price: number
  deviation_pct: number
  z_score: number
  signal: string
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  signal_color: string
  sl: number
  tp: number
  rr: number
  confidence: number
  factor_betas: number[]
  trade_logic: string
}

export interface StatArbTargetPosition {
  symbol: string
  z_score: number
  target_weight_pct: number
  current_price: number
  fair_price: number
  expected_return_pct: number
  r2_fit?: number
  action: 'BUY_LONG' | 'SELL_SHORT'
  trade_call: string
  status?: string
}

export interface StatArbRankingItem {
  symbol: string
  z_score: number
  current_price: number
  fair_price: number
  deviation_pct: number
  status: 'SIGNAL_BUY' | 'SIGNAL_SHORT' | 'NEUTRAL'
  r2_fit: number
  target_weight_pct: number
}

export interface StatArbUniverseResponse {
  success: boolean
  algorithm?: string
  universe_name?: string
  lookback_days: number
  pca_components: number
  entry_z_score?: number
  entry_z_score_threshold?: number
  free_cash_buffer_pct?: number
  total_variance_explained: number
  factor_variance_ratios: number[]
  triggered_count?: number
  portfolio_targets: StatArbTargetPosition[]
  short_targets: StatArbTargetPosition[]
  universe_rankings: StatArbRankingItem[]
  rebalance_cadence?: string
  evaluated_at?: string
  error?: string
}

export interface StrategyResult {
  signal:          SignalType
  signal_display:  SignalDisplay
  entry:           number
  sl:              number
  tp:              number
  rr:              number
  sl_pct:          number
  tp_pct:          number
  risk:            number
  reward:          number
  stoch_k:         number
  stoch_d:         number
  stoch_state:     StochState
  ema50:           number
  atr:             number
  price_above_ema: boolean
  near_ema:        boolean
  setup:           string[]
  ha_pattern:      HAPattern
  markers:         ChartMarker[]
  steps:           string[]
  ai_confirmation?: AIConfirmation
  adaptive_params?: AdaptiveParams
  statarb?: {
    success: boolean
    symbol_data?: StatArbItem
    universe_context?: {
      total_variance_explained?: number
      factor_variance_ratios?: number[]
      universe_size?: number
    }
  }
}

export interface TFResult {
  signal:         SignalType
  stoch_state:    StochState
  stoch_k:        number
  stoch_d:        number
  ema50:          number
  price:          number
  price_above_ema: boolean
  near_ema:       boolean
  timeframe:      string
  setup:          string[]
}

export interface MTFResult {
  daily:   TFResult
  h4:      TFResult
  h1:      TFResult
  m15:     TFResult
  overall: {
    bias:          string
    allowed_calls: string
    daily_bias:    string
    h4_bias:       string
  }
}

export interface LivePrice {
  symbol:     string
  price:      number
  change:     number
  change_pct: number
  time:       number
}

export interface NewsItem {
  source: string
  tag?:   string
  title:  string
  event_type?: string
  desc?:  string
  time:   string
  impact: 'HIGH' | 'MED' | 'LOW'
  currency?: string
  currencies?: string[]
  actual?: string
  forecast?: string
  previous?: string
  surprise?: string
  surprise_type?: 'BEAT' | 'MISS' | 'IN_LINE'
}

export type DrawingTool =
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'fibonacci'
  | 'rectangle'
  | 'long_position'
  | 'short_position'
  | 'measure'

export interface DrawingElement {
  id: string
  type: DrawingTool
  points: { x: number; y: number }[]
  color?: string
  label?: string
}

export interface SymbolConfig {
  label:    string
  ticker:   string
  category: string
  decimals: number
}

export const SYMBOLS: SymbolConfig[] = [
  // Forex
  { label: 'EUR/USD', ticker: 'EURUSD=X',  category: 'Forex',     decimals: 5 },
  { label: 'GBP/USD', ticker: 'GBPUSD=X',  category: 'Forex',     decimals: 5 },
  { label: 'USD/JPY', ticker: 'USDJPY=X',  category: 'Forex',     decimals: 3 },
  { label: 'USD/INR', ticker: 'USDINR=X',  category: 'Forex',     decimals: 4 },
  { label: 'EUR/INR', ticker: 'EURINR=X',  category: 'Forex',     decimals: 4 },
  { label: 'GBP/INR', ticker: 'GBPINR=X',  category: 'Forex',     decimals: 4 },
  { label: 'AUD/USD', ticker: 'AUDUSD=X',  category: 'Forex',     decimals: 5 },
  // Indian Stocks
  { label: 'NIFTY 50',  ticker: '^NSEI',          category: 'India',  decimals: 2 },
  { label: 'SENSEX',    ticker: '^BSESN',          category: 'India',  decimals: 2 },
  { label: 'RELIANCE',  ticker: 'RELIANCE.NS',     category: 'India',  decimals: 2 },
  { label: 'TCS',       ticker: 'TCS.NS',          category: 'India',  decimals: 2 },
  { label: 'HDFC Bank', ticker: 'HDFCBANK.NS',     category: 'India',  decimals: 2 },
  { label: 'INFY',      ticker: 'INFY.NS',         category: 'India',  decimals: 2 },
  { label: 'WIPRO',     ticker: 'WIPRO.NS',        category: 'India',  decimals: 2 },
  { label: 'ICICI Bank',ticker: 'ICICIBANK.NS',    category: 'India',  decimals: 2 },
  // Commodities
  { label: 'GOLD',      ticker: 'GC=F',            category: 'Commodity', decimals: 2 },
  { label: 'SILVER',    ticker: 'SI=F',            category: 'Commodity', decimals: 3 },
  { label: 'CRUDE WTI', ticker: 'CL=F',            category: 'Commodity', decimals: 2 },
  { label: 'BRENT',     ticker: 'BZ=F',            category: 'Commodity', decimals: 2 },
  { label: 'NAT GAS',   ticker: 'NG=F',            category: 'Commodity', decimals: 3 },
  { label: 'COPPER',    ticker: 'HG=F',            category: 'Commodity', decimals: 4 },
  // Crypto
  { label: 'Bitcoin (BTC)',   ticker: 'BTC-USD',   category: 'Crypto',    decimals: 2 },
  { label: 'Ethereum (ETH)',  ticker: 'ETH-USD',   category: 'Crypto',    decimals: 2 },
]

export const INTERVALS: { label: string; value: Interval; period: string }[] = [
  { label: '15m', value: '15m', period: '30d'  },
  { label: '1H',  value: '1h',  period: '60d'  },
  { label: '4H',  value: '4h',  period: '60d'  },
  { label: '1D',  value: '1d',  period: '1y'   },
  { label: '1W',  value: '1wk', period: '5y'   },
]
