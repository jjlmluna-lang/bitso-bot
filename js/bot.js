// ═══════════════════════════════════════════════════════
//  bot.js — Lógica de trading automático 24/7
// ═══════════════════════════════════════════════════════

const BOT = (() => {
  let loopInterval = null;
  let simInterval  = null;

  // ── Ejecutar trade (paper o real) ──
  async function executeTrade(book, dir, strategy) {
    const price = STATE.prices[book]?.last;
    if (!price || price <= 0) return;

    const amt  = ENGINE.kellyPosition(STATE.capital);
    if (amt < 1) return;

    const { sl, tp, atr } = ENGINE.sltp(book, dir, price);
    const fee  = amt * CFG.FEE_MAKER * 2;   // entrada + salida

    // ── PAPER TRADING ──
    if (STATE.mode === 'paper' || !STATE.connected) {
      const move   = atr * 2.5;   // simular TP hit vs SL
      const winRng = STATE.trades.length > 5
        ? STATE.wins / STATE.trades.length
        : 0.60;
      const isWin = Math.random() < winRng;
      const gross = isWin ? amt * (move / price) : -amt * (atr * 1.5 / price);
      const net   = gross - fee;
      recordTrade({ book, dir, price, amt, net, fee, strategy, sl, tp, paper: true });
      return;
    }

    // ── LIVE TRADING ──
    if (STATE.mode === 'live' && STATE.connected) {
      const sym    = book.split('_')[0].toUpperCase();
      const major  = (amt / price).toFixed(6);
      const limitP = dir === 'BUY'
        ? (price * 1.001).toFixed(6)   // comprar ligeramente sobre mercado
        : (price * 0.999).toFixed(6);  // vender ligeramente bajo mercado

      try {
        const res = await API.placeOrder({
          book,
          side:  dir === 'BUY' ? 'buy' : 'sell',
          type:  'limit',
          major,
          price: limitP,
        });

        if (res.success) {
          const net = -(amt * CFG.FEE_MAKER);  // solo fee de entrada — la ganancia llega al cerrar
          recordTrade({
            book, dir, price: parseFloat(limitP), amt,
            net, fee: amt * CFG.FEE_MAKER, strategy,
            sl, tp, paper: false, oid: res.payload.oid,
          });
          UI.showNotif(`✓ Orden ${dir} enviada · ${major} ${sym} @ $${limitP}`, 'success');

          // Colocar TP y SL automáticamente (OCO simplificado)
          scheduleTPSL(res.payload.oid, book, dir, parseFloat(major), tp, sl);
        } else {
          UI.showNotif('✗ Error Bitso: ' + (res.error?.message || 'desconocido'), 'error');
        }
      } catch (e) {
        UI.showNotif('✗ Error de red: ' + e.message, 'error');
      }
    }
  }

  // ── Programar TP/SL (monitoreo simple) ──
  function scheduleTPSL(parentOid, book, dir, qty, tp, sl) {
    // Monitorear precio y cerrar posición cuando TP o SL se alcanza
    const monitor = setInterval(async () => {
      const price = STATE.prices[book]?.last;
      if (!price) return;

      const tpHit = dir === 'BUY' ? price >= tp : price <= tp;
      const slHit = dir === 'BUY' ? price <= sl : price >= sl;

      if (tpHit || slHit) {
        clearInterval(monitor);
        if (STATE.mode === 'live' && STATE.connected) {
          const closeDir = dir === 'BUY' ? 'sell' : 'buy';
          await API.placeOrder({
            book, side: closeDir, type: 'market', major: qty.toFixed(6),
          });
          const pnl = tpHit ? qty * (tp - sl) : -(qty * Math.abs(price - sl) * 1.5);
          UI.showNotif(
            `${tpHit ? '✓ TP' : '✗ SL'} alcanzado · ${tpHit ? '+' : ''}$${pnl.toFixed(2)}`,
            tpHit ? 'success' : 'warn'
          );
        }
      }
    }, 5000);
  }

  // ── Registrar trade en historial ──
  function recordTrade({ book, dir, price, amt, net, fee, strategy, sl, tp, paper, oid }) {
    STATE.pnl      += net;
    STATE.capital  += net;
    STATE.todayPnl += net;

    if (net > 0) {
      STATE.wins++;
      STATE.consLosses = 0;
      if (net > STATE.bestTrade) STATE.bestTrade = net;
    } else {
      STATE.losses++;
      STATE.consLosses++;
      if (net < STATE.worstTrade) STATE.worstTrade = net;
    }

    const trade = {
      id:       Date.now(),
      time:     ts(),
      date:     tsDate(),
      book,
      sym:      book.split('_')[0].toUpperCase(),
      dir,
      price,
      amt,
      net,
      fee,
      capital:  STATE.capital,
      strategy,
      sl,
      tp,
      paper,
      oid:      oid || null,
      win:      net > 0,
    };
    STATE.trades.unshift(trade);
    if (STATE.trades.length > 500) STATE.trades.pop();

    // Actualizar fase según capital nuevo
    STATE.phase = detectPhase(STATE.capital);

    // Actualizar UI
    UI.addTradeRow(trade);
    UI.updateAllMetrics();
    UI.updateGoal();
    CHARTS.addEquityPoint(STATE.capital);

    // Alerta defensiva
    if (STATE.consLosses >= CFG.ENGINE.CONSEC_LOSSES) {
      UI.showNotif(
        `⚠ ${CFG.ENGINE.CONSEC_LOSSES} pérdidas seguidas · Modo defensivo activado · Pausa 15 min`,
        'warn'
      );
      pause();
      setTimeout(resume, 15 * 60 * 1000);
    }

    // Alerta máximo drawdown
    const dd = (STATE.startCapital - STATE.capital) / STATE.startCapital;
    if (dd > CFG.ENGINE.MAX_DD_PCT) {
      UI.showNotif(
        `⚠ Drawdown máximo -${(dd*100).toFixed(1)}% · Bot detenido · Revisar estrategia`,
        'error'
      );
      stop();
    }
  }

  // ── Simulación de precios (cuando WS no disponible) ──
  function startPriceSim() {
    if (simInterval) clearInterval(simInterval);
    simInterval = setInterval(() => {
      Object.keys(STATE.prices).forEach(book => {
        const p   = STATE.prices[book];
        const vol = book === 'btc_usdc' ? 0.0015 : 0.003;
        const newP = p.last * (1 + (Math.random() - 0.499) * vol);
        // Límites realistas por par
        const bounds = {
          xrp_usdc: [1.20, 1.90], btc_usdc: [78000, 92000],
          eth_usdc: [2600, 3100],  sol_usdc: [130, 175],
        };
        const [lo, hi] = bounds[book] || [p.last * 0.8, p.last * 1.2];
        const clamped = Math.max(lo, Math.min(hi, newP));
        const old = p.last;
        p.last = clamped;
        if (clamped > p.high) p.high = clamped;
        if (clamped < p.low)  p.low  = clamped;

        UI.updateTicker(book, clamped, old);
        CHARTS.addPricePoint(book, clamped);
        ENGINE.tick(book);
      });
    }, 2000);
  }

  // ── Loop principal del bot ──
  function mainLoop() {
    STATE.tick++;
    const book = STATE.params.activePair;

    // Actualizar indicadores cada tick
    if (STATE.tick % 2 === 0) {
      const decision = ENGINE.decide(book);
      UI.updateSignals(decision.signals, decision.buys, decision.sells);
      UI.updateMOS(decision.mos);
      UI.updateRegime(decision.regime);
      UI.updateRiskPanel(book);

      // ── Ejecutar trade si hay señal y el bot está activo ──
      if (STATE.botOn && decision.direction) {
        const strats = Object.values(CFG.STRATEGIES);
        const strat  = strats[Math.floor(Math.random() * strats.length)].name;
        executeTrade(book, decision.direction, strat);
      }
    }

    // Actualizar OB simulado cuando WS no está conectado
    if (STATE.tick % 4 === 0 && !API.isWSConnected()) {
      UI.updateOrderBookSim(book);
    }

    // Actualizar precio BTC en topbar
    if (STATE.tick % 3 === 0) {
      UI.updateTopbarBTC();
    }
  }

  // ── Control del bot ──
  function start() {
    if (loopInterval) return;
    STATE.botOn = true;
    loopInterval = setInterval(mainLoop, CFG.ENGINE.LOOP_MS);
    startPriceSim();
    UI.setBotStatus(true);
  }

  function pause() {
    STATE.botOn = false;
    UI.setBotStatus(false);
  }

  function resume() {
    STATE.botOn = true;
    UI.setBotStatus(true);
  }

  function stop() {
    STATE.botOn = false;
    if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
    if (simInterval)  { clearInterval(simInterval);  simInterval  = null; }
    UI.setBotStatus(false);
  }

  function toggle() {
    if (STATE.botOn) pause(); else resume();
  }

  // Ejecutar orden manual desde el panel
  async function manualOrder(book, dir, amt) {
    const price = STATE.prices[book]?.last;
    const fee   = amt * CFG.FEE_MAKER * 2;
    const isWin = Math.random() > 0.38;
    const move  = price * (Math.random() * 0.025 + 0.005);
    const net   = isWin ? move * (amt / price) - fee : -(price * 0.025 * (amt / price)) - fee;
    recordTrade({ book, dir, price, amt, net, fee, strategy: 'MANUAL', sl: 0, tp: 0, paper: true });
  }

  return { start, pause, resume, stop, toggle, executeTrade, manualOrder, recordTrade };
})();
