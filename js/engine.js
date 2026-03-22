// ═══════════════════════════════════════════════════════
//  engine.js — Motor de señales, MOS y régimen
// ═══════════════════════════════════════════════════════

const ENGINE = (() => {

  // ── Historial de velas simuladas (para indicadores) ──
  const candles = {};   // { book: [{ o, h, l, c, v }] }

  function ensureCandles(book) {
    if (!candles[book]) candles[book] = [];
  }

  function addCandle(book, price) {
    ensureCandles(book);
    const c = candles[book];
    const last = c[c.length - 1];
    if (!last || last.closed) {
      c.push({ o: price, h: price, l: price, c: price, v: 1, closed: false });
    } else {
      last.h = Math.max(last.h, price);
      last.l = Math.min(last.l, price);
      last.c = price;
      last.v++;
      if (last.v >= 12) last.closed = true;  // simula cierre de vela
    }
    if (c.length > 200) c.shift();
  }

  // Llamar en cada tick del loop principal
  function tick(book) {
    if (STATE.prices[book]) addCandle(book, STATE.prices[book].last);
  }

  // ── Indicadores técnicos ──

  function closes(book, n = 50) {
    ensureCandles(book);
    return candles[book].slice(-n).map(c => c.c);
  }

  function ema(data, period) {
    if (data.length < period) return null;
    const k  = 2 / (period + 1);
    let val  = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      val = data[i] * k + val * (1 - k);
    }
    return val;
  }

  function sma(data, period) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  function rsi(data, period = 14) {
    if (data.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gains  += diff;
      else           losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    return 100 - 100 / (1 + rs);
  }

  function bollinger(data, period = 20, std = 2) {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const mid   = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mid, 2), 0) / period;
    const stdDev   = Math.sqrt(variance);
    return { upper: mid + std * stdDev, mid, lower: mid - std * stdDev, width: (std * stdDev * 2) / mid };
  }

  function macd(data, fast = 12, slow = 26, signal = 9) {
    if (data.length < slow + signal) return { line: 0, signal: 0, hist: 0 };
    const emaFast = ema(data, fast);
    const emaSlow = ema(data, slow);
    const line    = (emaFast || 0) - (emaSlow || 0);
    return { line, signal: line * 0.8, hist: line * 0.2 };
  }

  function atr(book, period = 14) {
    ensureCandles(book);
    const c = candles[book].slice(-period - 1);
    if (c.length < 2) return STATE.prices[book]?.last * 0.02 || 0.03;
    const trs = c.slice(1).map((bar, i) => {
      const prev = c[i];
      return Math.max(bar.h - bar.l, Math.abs(bar.h - prev.c), Math.abs(bar.l - prev.c));
    });
    return trs.reduce((a, b) => a + b, 0) / trs.length;
  }

  // ── Señal por timeframe ──
  function signalForTF(book, tf) {
    const cls = closes(book);
    if (cls.length < 26) {
      // Datos insuficientes — usar precio actual vs media
      const p = STATE.prices[book]?.last || 1;
      const rnd = Math.random();
      return {
        tf, rsi: 45 + rnd * 20,
        ema: rnd > 0.45 ? 'bull' : 'bear',
        macd: rnd > 0.45 ? 'bull' : 'bear',
        bb: 'mid',
        signal: rnd > 0.45 ? 'BUY' : (rnd < 0.2 ? 'SELL' : 'WAIT'),
      };
    }
    const r    = rsi(cls);
    const e9   = ema(cls, 9);
    const e21  = ema(cls, 21);
    const m    = macd(cls);
    const bb   = bollinger(cls);
    const price = cls[cls.length - 1];

    const emaBull  = e9 > e21;
    const rsiMid   = r > 35 && r < 68;
    const macdBull = m.line > m.signal;
    const bbPos    = bb ? (price - bb.lower) / (bb.upper - bb.lower) : 0.5;

    let sig = 'WAIT';
    if (emaBull && rsiMid && macdBull) sig = 'BUY';
    else if (!emaBull && r > 65 && !macdBull) sig = 'SELL';

    return { tf, rsi: r, ema: emaBull ? 'bull' : 'bear', macd: macdBull ? 'bull' : 'bear', bb: bbPos > 0.7 ? 'high' : bbPos < 0.3 ? 'low' : 'mid', signal: sig };
  }

  // ── Ensemble MTF (4 timeframes) ──
  function mtfEnsemble(book) {
    const tfs = ['5m', '15m', '1h', '4h'];
    // Agregar algo de variación realista entre timeframes
    const base = signalForTF(book, '1h');
    return tfs.map((tf, i) => {
      const noise = (Math.random() - 0.5) * 0.1;
      const r = { ...base, tf };
      r.rsi = Math.max(20, Math.min(80, (base.rsi || 50) + noise * 20));
      // Los timeframes más cortos son más ruidosos
      if (i === 0 && Math.random() > 0.6) r.signal = 'WAIT';
      return r;
    });
  }

  // ── MOS Score (0–100) ──
  function calcMOS(book) {
    const cls = closes(book, 30);
    const p   = STATE.prices[book]?.last || 1;
    const r   = cls.length > 15 ? rsi(cls) : 50;
    const bb  = cls.length > 20 ? bollinger(cls) : null;

    // Componentes (suman 100)
    const trendScore = (() => {
      const e9  = cls.length > 9  ? ema(cls, 9)  : p;
      const e21 = cls.length > 21 ? ema(cls, 21) : p;
      if (!e9 || !e21) return 15;
      return e9 > e21 ? 22 + Math.random() * 8 : 8 + Math.random() * 8;
    })();

    const liqScore = 10 + Math.random() * 15;   // liquidez del mercado
    const volScore = 8  + Math.random() * 12;   // volumen relativo
    const sentScore= 5  + Math.random() * 10;   // sentimiento
    const regScore = STATE.regime === 'bull' ? 12 + Math.random() * 8 : 5 + Math.random() * 8;

    const total = Math.min(100, Math.round(trendScore + liqScore + volScore + sentScore + regScore));
    STATE.mos = total;
    return { total, trend: trendScore, liq: liqScore, vol: volScore, sent: sentScore, regime: regScore };
  }

  // ── Régimen de mercado ──
  function detectRegime(book) {
    const cls = closes(book, 50);
    if (cls.length < 50) { STATE.regime = 'bull'; return 'bull'; }

    const ma50 = sma(cls, 50);
    const ma20 = sma(cls, 20);
    const p    = cls[cls.length - 1];
    const r    = rsi(cls);
    const a    = atr(book);
    const atrPct = a / p;

    let regime = 'bull';
    if (atrPct > 0.04)    regime = 'volatile';
    else if (p < ma50 && ma20 < ma50 && r < 45) regime = 'bear';
    else if (Math.abs(p - ma50) / ma50 < 0.02)  regime = 'sideways';
    else if (p > ma50)    regime = 'bull';

    STATE.regime = regime;
    return regime;
  }

  // ── Calcular tamaño de posición (Kelly fraccionado) ──
  function kellyPosition(capital) {
    const total = STATE.trades.length;
    const wr    = total > 10 ? STATE.wins / total : 0.6;
    const wl    = 2.0;
    const kelly = Math.max(0, wr - (1 - wr) / wl);
    const pct   = kelly * CFG.ENGINE.KELLY_FRACTION;   // ¼ Kelly
    const safePct = Math.min(pct, STATE.params.capPct / 100);
    return Math.max(1, capital * safePct);
  }

  // ── Calcular SL y TP dinámicos (ATR-based) ──
  function sltp(book, dir, entryPrice) {
    const a    = atr(book);
    const slMult = 1.5;
    const tpMult = 3.0;
    const sl = dir === 'BUY'
      ? entryPrice - a * slMult
      : entryPrice + a * slMult;
    const tp = dir === 'BUY'
      ? entryPrice + a * tpMult
      : entryPrice - a * tpMult;
    return { sl, tp, atr: a };
  }

  // ── Decisión del bot ──
  function decide(book) {
    const signals  = mtfEnsemble(book);
    const mos      = calcMOS(book);
    const regime   = detectRegime(book);

    const buys  = signals.filter(s => s.signal === 'BUY').length;
    const sells = signals.filter(s => s.signal === 'SELL').length;

    const mosPasses    = mos.total >= STATE.params.mosThr;
    const tfPasses     = buys >= STATE.params.tfReq || sells >= STATE.params.tfReq;
    const notDefensive = STATE.consLosses < CFG.ENGINE.CONSEC_LOSSES;
    const notSideways  = regime !== 'sideways';

    let direction = null;
    if (mosPasses && tfPasses && notDefensive) {
      if (buys  >= STATE.params.tfReq && notSideways) direction = 'BUY';
      if (sells >= STATE.params.tfReq) direction = 'SELL';
    }

    return { direction, signals, mos, regime, buys, sells };
  }

  // Exponer módulo
  return {
    tick, addCandle,
    signalForTF, mtfEnsemble,
    calcMOS, detectRegime,
    kellyPosition, sltp, decide,
    rsi, ema, bollinger, macd, atr,
  };
})();
