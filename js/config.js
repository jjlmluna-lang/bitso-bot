// ═══════════════════════════════════════════════════════
//  config.js — Configuración global del bot
//  Bitso Trading Bot 24/7 · México
// ═══════════════════════════════════════════════════════

const CFG = {
  version: '3.0.0',
  author:  'Bitso Bot MX',

  // ── API ──
  API_BASE: 'https://api.bitso.com/v3',
  WS_URL:   'wss://ws.bitso.com',

  // ── Capital inicial ──
  INITIAL_CAPITAL: 91,   // USDC

  // ── Fees Bitso (actualizados marzo 2026) ──
  FEE_MAKER:  0.0015,   // 0.15% — usar siempre órdenes LIMIT
  FEE_TAKER:  0.0019,   // 0.19% — órdenes MARKET (evitar)

  // ── Pares disponibles ──
  PAIRS: [
    { book: 'xrp_usdc',  sym: 'XRP',  name: 'XRP / USDC',  phase: 1, color: '#00aae4' },
    { book: 'btc_usdc',  sym: 'BTC',  name: 'BTC / USDC',  phase: 1, color: '#f5a020' },
    { book: 'eth_usdc',  sym: 'ETH',  name: 'ETH / USDC',  phase: 2, color: '#8b5cf6' },
    { book: 'sol_usdc',  sym: 'SOL',  name: 'SOL / USDC',  phase: 3, color: '#00d084' },
    { book: 'ltc_usdc',  sym: 'LTC',  name: 'LTC / USDC',  phase: 2, color: '#60a5fa' },
    { book: 'usdt_mxn',  sym: 'USDT', name: 'USDT / MXN',  phase: 1, color: '#4a9eff' },
  ],

  // ── Estrategias ──
  STRATEGIES: {
    DCA: {
      name:    'DCA Semanal',
      phase:   1,
      pairs:   ['btc_usdc'],
      desc:    'Compra fija semanal sin importar el precio',
      weekday: 5,           // viernes
      pct:     0.10,        // 10% del capital por compra DCA
    },
    SWING_SR: {
      name:    'Swing S/R',
      phase:   1,
      pairs:   ['xrp_usdc'],
      desc:    'Soporte/Resistencia en XRP',
      support: [1.30, 1.50],
      resist:  [1.62, 1.82],
      tp1_pct: 0.102,       // +10.2%
      tp2_pct: 0.238,       // +23.8%
      sl_pct:  0.025,       // -2.5%
    },
    EMA_CROSS: {
      name:    'EMA Crossover 9/21',
      phase:   2,
      pairs:   ['xrp_usdc', 'eth_usdc'],
      desc:    'EMA9 cruza EMA21 en 1h',
      fast:    9,
      slow:    21,
      tf:      '1h',
      pct:     0.25,        // 25% del capital
    },
    RSI_BOUNCE: {
      name:    'RSI Oversold Bounce',
      phase:   2,
      pairs:   ['xrp_usdc', 'eth_usdc', 'sol_usdc'],
      desc:    'RSI < 30 rebote con vela verde',
      oversold:   30,
      overbought: 70,
      tf:      '4h',
      pct:     0.20,
    },
    BB_SQUEEZE: {
      name:    'Bollinger Squeeze',
      phase:   3,
      pairs:   ['xrp_usdc', 'sol_usdc'],
      desc:    'Ruptura después de compresión BB',
      period:  20,
      stddev:  2.0,
      tf:      '4h',
      pct:     0.15,
    },
    GRID: {
      name:    'Grid Trading',
      phase:   3,
      pairs:   ['xrp_usdc'],
      desc:    '10 niveles automáticos en rango',
      levels:  10,
      range_low:  1.30,
      range_high: 1.85,
      pct_per_level: 0.08,  // 8% por nivel
    },
  },

  // ── Portafolios por fase ──
  PORTFOLIOS: {
    1: [
      { sym:'BTC', pct:0.50, role:'Base de valor · DCA sin vender' },
      { sym:'XRP', pct:0.35, role:'Swing activo' },
      { sym:'USDC', pct:0.15, role:'Reserva + Rendimientos Bitso' },
    ],
    2: [
      { sym:'BTC',  pct:0.40, role:'DCA continúa' },
      { sym:'XRP',  pct:0.25, role:'Swing EMA/RSI' },
      { sym:'ETH',  pct:0.20, role:'Swing 2-4 semanas' },
      { sym:'USDC', pct:0.15, role:'Reserva fija' },
    ],
    3: [
      { sym:'BTC',  pct:0.35, role:'DCA + swing correcciones' },
      { sym:'ETH',  pct:0.20, role:'Swing + Rendimientos' },
      { sym:'SOL',  pct:0.15, role:'Grid + Rendimientos' },
      { sym:'XRP',  pct:0.15, role:'Grid trading activo' },
      { sym:'USDC', pct:0.15, role:'Reserva en Rendimientos' },
    ],
    4: [
      { sym:'BTC',  pct:0.30, role:'Swing mensual + staking' },
      { sym:'ETH',  pct:0.20, role:'Rendimientos + swing' },
      { sym:'SOL',  pct:0.15, role:'Grid automático' },
      { sym:'XRP',  pct:0.10, role:'Grid + swing' },
      { sym:'ETFs', pct:0.20, role:'Cobertura: Nasdaq, S&P 500' },
      { sym:'USDC', pct:0.05, role:'Operativo' },
    ],
    5: [
      { sym:'BTC',  pct:0.30, role:'Reserva institucional' },
      { sym:'ETH',  pct:0.20, role:'Staking APY + swing' },
      { sym:'SOL',  pct:0.10, role:'Bot grid 24/7' },
      { sym:'XRP',  pct:0.10, role:'Bot swing 24/7' },
      { sym:'ETFs', pct:0.20, role:'Cobertura global' },
      { sym:'USDC', pct:0.10, role:'Rendimientos semanales' },
    ],
  },

  // ── Hitos hacia $1M ──
  MILESTONES: [
    { n:1,  cap:182,      label:'$182',       doublings:1  },
    { n:2,  cap:364,      label:'$364',       doublings:2  },
    { n:3,  cap:728,      label:'$728',       doublings:3  },
    { n:4,  cap:1456,     label:'$1,456',     doublings:4  },
    { n:5,  cap:2912,     label:'$2,912',     doublings:5  },
    { n:6,  cap:5825,     label:'$5,825',     doublings:6  },
    { n:7,  cap:11650,    label:'$11,650',    doublings:7  },
    { n:8,  cap:23300,    label:'$23,300',    doublings:8  },
    { n:9,  cap:46600,    label:'$46,600',    doublings:9  },
    { n:10, cap:93200,    label:'$93,200',    doublings:10 },
    { n:11, cap:186400,   label:'$186,400',   doublings:11 },
    { n:12, cap:372800,   label:'$372,800',   doublings:12 },
    { n:13, cap:745600,   label:'$745,600',   doublings:13 },
    { n:14, cap:1000000,  label:'$1,000,000', doublings:14 },
  ],

  // ── Parámetros del motor ──
  ENGINE: {
    MOS_MIN:        62,    // MOS mínimo para operar
    TF_CONFIRM:     3,     // timeframes que deben confirmar
    MAX_RISK_PCT:   0.025, // 2.5% máx riesgo por trade
    KELLY_FRACTION: 0.25,  // usar ¼ Kelly
    MAX_DD_PCT:     0.12,  // drawdown máximo mensual: 12%
    CONSEC_LOSSES:  3,     // pérdidas consecutivas → pausa
    LOOP_MS:        3000,  // frecuencia del bot en ms
    WS_RECONNECT:   5000,  // reconexión WS en ms
  },
};

// Estado global compartido entre módulos
const STATE = {
  // Precios en tiempo real
  prices: {
    xrp_usdc: { last: 1.47,   open: 1.47,  high: 1.52, low: 1.34,  vol: 0 },
    btc_usdc: { last: 84200,  open: 83500, high: 85000, low: 82000, vol: 0 },
    eth_usdc: { last: 2820,   open: 2800,  high: 2850,  low: 2770,  vol: 0 },
    sol_usdc: { last: 148,    open: 145,   high: 152,   low: 142,   vol: 0 },
  },

  // Capital y P&L
  capital:      CFG.INITIAL_CAPITAL,
  startCapital: CFG.INITIAL_CAPITAL,
  pnl:          0,
  todayPnl:     0,

  // Operaciones
  trades:     [],
  wins:       0,
  losses:     0,
  bestTrade:  0,
  worstTrade: 0,
  consLosses: 0,

  // Bot
  botOn:     true,
  mode:      'paper',   // 'paper' | 'live'
  connected: false,
  phase:     1,

  // API
  apiKey:    '',
  apiSecret: '',

  // Motor
  mos:       65,
  regime:    'bull',
  tick:      0,

  // Parámetros ajustables
  params: {
    mosThr:  CFG.ENGINE.MOS_MIN,
    tfReq:   CFG.ENGINE.TF_CONFIRM,
    capPct:  15,
    slPct:   2.5,
    activePair: 'xrp_usdc',
  },
};

// Detectar la fase actual según el capital
function detectPhase(capital) {
  if (capital >= 100000) return 5;
  if (capital >= 15000)  return 4;
  if (capital >= 2000)   return 3;
  if (capital >= 500)    return 2;
  return 1;
}

// Formatear números
const fmt = (n, dec = 2) =>
  typeof n === 'number'
    ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : '—';

const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n * 17.3);

// Timestamp
const ts = () => new Date().toTimeString().slice(0, 8);
const tsDate = () => new Date().toLocaleDateString('es-MX');
