// ═══════════════════════════════════════════════════════
//  ui.js — Actualización del DOM y dashboard
// ═══════════════════════════════════════════════════════

const UI = (() => {

  // ── Helpers ──
  const el  = id => document.getElementById(id);
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
  const setH = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
  const setC = (id, cls) => { const e = el(id); if (e) e.className = cls; };

  function ts() { return new Date().toTimeString().slice(0, 8); }

  // ── Ticker ──
  function updateTicker(book, price, old) {
    if (book !== STATE.params.activePair) return;
    const pct = (price - STATE.prices[book].open) / STATE.prices[book].open * 100;
    const dir  = price >= old ? 'up' : 'dn';

    const priceEl = el('tbPrice');
    if (priceEl) {
      priceEl.textContent = '$' + fmt(price, price > 100 ? 2 : 4);
      priceEl.className   = 'live-price ' + dir;
    }
    const pctEl = el('tbPct');
    if (pctEl) {
      pctEl.textContent = (pct >= 0 ? '+' : '') + fmt(pct, 2) + '%';
      pctEl.className   = 'pct ' + (pct >= 0 ? 'up' : 'dn');
    }
  }

  function updateTopbarBTC() {
    const p = STATE.prices['btc_usdc']?.last;
    if (p) set('tbBTC', 'BTC $' + Math.round(p).toLocaleString('en'));
  }

  function refreshAllTickers() {
    Object.keys(STATE.prices).forEach(book => {
      updateTicker(book, STATE.prices[book].last, STATE.prices[book].last);
    });
    updateTopbarBTC();
  }

  // ── Order Book ──
  function updateOrderBook(payload) {
    const bids = (payload.bids || []).slice(0, 8);
    const asks = (payload.asks || []).slice(0, 8);
    if (!bids.length && !asks.length) return;

    const maxBV = Math.max(...bids.map(b => parseFloat(b.a || b[1] || 0)), 1);
    const maxAV = Math.max(...asks.map(a => parseFloat(a.a || a[1] || 0)), 1);

    const renderSide = (items, maxV, side) => items.map(row => {
      const p   = parseFloat(row.r || row[0] || 0).toFixed(4);
      const amt = parseFloat(row.a || row[1] || 0).toFixed(4);
      const pct = (parseFloat(row.a || row[1] || 0) / maxV * 80).toFixed(0);
      const bgStyle = side === 'bid'
        ? `position:absolute;right:0;top:0;height:100%;background:rgba(0,204,122,0.07);width:${pct}%`
        : `position:absolute;left:0;top:0;height:100%;background:rgba(255,59,80,0.07);width:${pct}%`;
      return `<div style="display:flex;justify-content:space-between;padding:4px 10px;font-family:var(--mono);font-size:10px;position:relative;overflow:hidden">
        <div style="${bgStyle}"></div>
        <span style="color:${side==='bid'?'var(--g)':'var(--r)'}">${p}</span>
        <span style="color:var(--muted2)">${amt}</span>
      </div>`;
    }).join('');

    setH('bids', renderSide(bids, maxBV, 'bid'));
    setH('asks', renderSide(asks, maxAV, 'ask'));

    if (bids.length && asks.length) {
      const spread = Math.abs(
        parseFloat(asks[0].r || asks[0][0] || 0) -
        parseFloat(bids[0].r || bids[0][0] || 0)
      );
      set('spreadVal', '$' + spread.toFixed(6));

      const bVol = bids.reduce((s, b) => s + parseFloat(b.a || b[1] || 0), 0);
      const aVol = asks.reduce((s, a) => s + parseFloat(a.a || a[1] || 0), 0);
      const imb  = ((bVol - aVol) / (bVol + aVol) * 100).toFixed(1);
      const imbEl = el('imbVal');
      if (imbEl) {
        imbEl.textContent = (imb > 0 ? '+' : '') + imb + '%';
        imbEl.style.color = imb > 0 ? 'var(--g)' : 'var(--r)';
      }
    }
  }

  function updateOrderBookSim(book) {
    const base = STATE.prices[book]?.last || 1.47;
    const fakePayload = {
      bids: Array.from({ length: 8 }, (_, i) => ({
        r: (base - i * base * 0.0008).toFixed(6),
        a: (Math.random() * 200 + 20).toFixed(0),
      })),
      asks: Array.from({ length: 8 }, (_, i) => ({
        r: (base + (i + 1) * base * 0.0008).toFixed(6),
        a: (Math.random() * 200 + 20).toFixed(0),
      })),
    };
    updateOrderBook(fakePayload);
  }

  // ── Señales MTF ──
  function updateSignals(signals, buys, sells) {
    const grid = el('sigGrid');
    if (!grid) return;
    grid.innerHTML = signals.map(s => `
      <div style="background:var(--s2);border:1px solid ${s.signal==='BUY'?'rgba(0,204,122,.4)':s.signal==='SELL'?'rgba(255,59,80,.4)':'var(--b)'};border-radius:7px;padding:12px;text-align:center">
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted2);margin-bottom:6px">${s.tf}</div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:600;color:${s.signal==='BUY'?'var(--g)':s.signal==='SELL'?'var(--r)':'var(--muted2)'}">${s.signal}</div>
        <div style="font-size:10px;color:var(--muted2);margin-top:4px">RSI ${parseFloat(s.rsi).toFixed(0)} · EMA ${s.ema} · BB ${s.bb}</div>
      </div>`).join('');

    const badge = el('ensembleSignal');
    if (badge) {
      if (buys >= STATE.params.tfReq)       { badge.textContent = 'COMPRA CONFIRMADA'; badge.className = 'badge bg'; }
      else if (sells >= STATE.params.tfReq) { badge.textContent = 'VENTA CONFIRMADA';  badge.className = 'badge br'; }
      else                                   { badge.textContent = 'SEÑAL MIXTA';       badge.className = 'badge ba'; }
    }
    set('tfScore', buys + '/4');
  }

  // ── MOS ──
  function updateMOS(mos) {
    drawGauge('mosGauge',  mos.total);
    drawGauge('mosGauge2', mos.total);

    const comps = [
      { id:'mf-tend', vid:'mv-tend', val:mos.trend,  max:30 },
      { id:'mf-liq',  vid:'mv-liq',  val:mos.liq,    max:25 },
      { id:'mf-vol',  vid:'mv-vol',  val:mos.vol,     max:25 },
      { id:'mf-sent', vid:'mv-sent', val:mos.sent,    max:15 },
      { id:'mf-reg',  vid:'mv-reg',  val:mos.regime,  max:20 },
    ];
    comps.forEach(({ id, vid, val, max }) => {
      const fill = el(id);
      if (fill) fill.style.width = Math.min(100, val / max * 100).toFixed(0) + '%';
      set(vid, Math.round(val));
    });

    const badge = el('mosStatusBadge');
    if (badge) {
      if (mos.total > 60)      { badge.textContent = 'OPERAR';       badge.className = 'badge bg'; }
      else if (mos.total > 30) { badge.textContent = 'CONSERVADOR';  badge.className = 'badge ba'; }
      else                      { badge.textContent = 'NO OPERAR';   badge.className = 'badge br'; }
    }

    CHARTS.addMOSPoint(mos.total);
  }

  // ── Gauge canvas ──
  function drawGauge(canvasId, value) {
    const canvas = el(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h - 8, r = h - 18;

    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = '#1a2230'; ctx.lineWidth = 10; ctx.stroke();

    const color = value > 60 ? '#00cc7a' : value > 30 ? '#f5a020' : '#ff3b50';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (value / 100) * Math.PI);
    ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(r * 0.55)}px IBM Plex Mono`;
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(value), cx, cy - 2);
  }

  // ── Régimen ──
  const REGIMES = {
    bull:     { icon: '📈', label: 'Bull Market',    color: 'var(--g)',  bg: 'rgba(0,204,122,0.15)' },
    bear:     { icon: '📉', label: 'Bear Market',    color: 'var(--r)',  bg: 'rgba(255,59,80,0.15)' },
    sideways: { icon: '↔',  label: 'Sideways',       color: 'var(--a)',  bg: 'rgba(245,160,32,0.15)' },
    volatile: { icon: '⚡', label: 'Alta Volatilidad',color: 'var(--pu)',bg: 'rgba(139,92,246,0.15)' },
  };

  function updateRegime(regime) {
    const R = REGIMES[regime] || REGIMES.bull;
    setH('regimeDisplay', `
      <div style="width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;background:${R.bg}">${R.icon}</div>
      <div>
        <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:${R.color}">${R.label}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">${
          regime === 'bull' ? 'Tendencia alcista · aumentar posiciones' :
          regime === 'bear' ? 'Tendencia bajista · reducir exposición' :
          regime === 'sideways' ? 'Mercado lateral · reducir operaciones' :
          'Volatilidad extrema · modo defensivo'
        }</div>
      </div>`);
    const badge = el('regimeBadge');
    if (badge) {
      badge.textContent = R.label.split(' ')[0].toUpperCase();
      badge.className   = `badge ${regime==='bull'?'bg':regime==='bear'?'br':'ba'}`;
    }
  }

  // ── Risk panel ──
  function updateRiskPanel(book) {
    const p   = STATE.prices[book]?.last || 1;
    const sl  = p * (1 - STATE.params.slPct / 100);
    const tp  = p * (1 + STATE.params.slPct / 100 * 2.5);
    const wr  = STATE.trades.length > 0 ? STATE.wins / STATE.trades.length : 0.6;
    const panel = el('riskPanel');
    if (!panel) return;
    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">Stop Loss</span><span style="font-family:var(--mono);color:var(--r)">$${sl.toFixed(4)} (-${STATE.params.slPct}%)</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">Take Profit</span><span style="font-family:var(--mono);color:var(--g)">$${tp.toFixed(4)} (+${(STATE.params.slPct*2.5).toFixed(1)}%)</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">Ratio R:R</span><span style="font-family:var(--mono);color:var(--bl)">1 : 2.5</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">Win rate real</span><span style="font-family:var(--mono);color:var(--a)">${(wr*100).toFixed(1)}%</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">MOS actual</span><span style="font-family:var(--mono);color:${STATE.mos>STATE.params.mosThr?'var(--g)':'var(--a)'}">${STATE.mos} ${STATE.mos>STATE.params.mosThr?'✓':'⚠'}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--muted2)">Pérdidas consec.</span><span style="font-family:var(--mono);color:${STATE.consLosses>=2?'var(--r)':'var(--g)'}">${STATE.consLosses} / ${CFG.ENGINE.CONSEC_LOSSES}</span></div>
      </div>`;
  }

  // ── Trade row ──
  function addTradeRow(t) {
    const html = `<div class="lr fade" style="background:${t.win?'rgba(0,204,122,0.025)':'rgba(255,59,80,0.025)'}">
      <div style="color:var(--muted2)">${t.time}</div>
      <div style="color:var(--xrp)">${t.sym}</div>
      <div><span class="dir ${t.dir.toLowerCase()}">${t.dir}</span></div>
      <div>$${fmt(t.price, t.price>100?2:4)}</div>
      <div>$${fmt(t.amt,2)}</div>
      <div class="${t.win?'win':'loss'}">${t.win?'+':''} $${fmt(Math.abs(t.net),3)}</div>
      <div style="color:${t.capital>CFG.INITIAL_CAPITAL?'var(--g)':'var(--r)'}">$${fmt(t.capital,2)}</div>
      <div style="color:var(--muted2);font-size:9px">${t.strategy}${t.paper?'·P':''}</div>
    </div>`;

    ['tradeLog', 'fullLog'].forEach(id => {
      const feed = el(id);
      if (!feed) return;
      // Quitar mensaje inicial si existe
      if (feed.children.length === 1 && feed.children[0].className !== 'lr fade') {
        feed.innerHTML = '';
      }
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      feed.insertBefore(tmp.firstElementChild, feed.firstChild);
      if (feed.children.length > 100) feed.removeChild(feed.lastChild);
    });

    // Actualizar contador
    set('opCount', STATE.trades.length + ' ops');
  }

  // ── Métricas ──
  function updateAllMetrics() {
    const total   = STATE.trades.length;
    const wr      = total > 0 ? (STATE.wins / total * 100).toFixed(1) + '%' : '—';
    const pnlPct  = ((STATE.capital - STATE.startCapital) / STATE.startCapital * 100).toFixed(2);

    set('d-cap',    '$' + fmt(STATE.capital));
    set('d-pnl',    (STATE.pnl >= 0 ? '+$' : '-$') + fmt(Math.abs(STATE.pnl)));
    set('d-pnlpct', (STATE.pnl >= 0 ? '+' : '') + pnlPct + '%');
    set('d-ops',    total);
    set('d-wr',     'Win rate: ' + wr);
    set('s-today',  (STATE.todayPnl>=0?'+$':'-$') + fmt(Math.abs(STATE.todayPnl)));
    set('s-wins',   STATE.wins);
    set('s-loss',   STATE.losses);
    set('s-wr',     wr);
    set('t-total',  total);
    set('t-wins',   STATE.wins);
    set('t-losses', STATE.losses);
    set('t-pf',     STATE.losses > 0 ? (STATE.wins / STATE.losses).toFixed(2) : '∞');
    set('t-best',   '+$' + fmt(STATE.bestTrade, 3));
    set('pp-capital', '$' + fmt(STATE.capital));

    const pnlEl = el('d-pnl');
    if (pnlEl) pnlEl.style.color = STATE.pnl >= 0 ? 'var(--g)' : 'var(--r)';

    // Actualizar Kelly
    const wr0 = total > 10 ? STATE.wins / total : 0.6;
    const kelly = Math.max(0, wr0 - (1 - wr0) / 2.0);
    set('kellyWR',  (wr0 * 100).toFixed(1) + '%');
    set('kellyPct', (kelly * 100).toFixed(1) + '%');
    set('kellyPos', '$' + fmt(STATE.capital * kelly * CFG.ENGINE.KELLY_FRACTION, 2));

    // Fase actual
    const phaseEl = el('phaseLabel');
    const phases  = ['', 'SEMILLA', 'ARRANQUE', 'CRECIMIENTO', 'ESCALA', 'PROFESIONAL'];
    if (phaseEl) phaseEl.textContent = `FASE ${STATE.phase} · ${phases[STATE.phase]}`;
  }

  // ── Progreso meta $1M ──
  function updateGoal() {
    const logPct = (Math.log(Math.max(91, STATE.capital)) - Math.log(91)) /
                   (Math.log(1000000) - Math.log(91)) * 100;
    const pctAbs = (STATE.capital / 1000000 * 100).toFixed(6);

    const bar = el('goalBar');
    if (bar) bar.style.width = Math.max(0.01, logPct).toFixed(3) + '%';
    set('goalPct', pctAbs + '%');
    set('d-prog',  pctAbs + '%');

    const nextM = CFG.MILESTONES.find(m => m.cap > STATE.capital);
    if (nextM) set('d-next', nextM.label);

    // Milestone table
    const tbody = el('milestonesBody');
    if (tbody) {
      tbody.innerHTML = CFG.MILESTONES.map(m => {
        const done = STATE.capital >= m.cap;
        const curr = !done && STATE.capital >= m.cap / 2;
        const cls  = done ? 'done' : curr ? 'current' : 'future';
        const icon = done ? '<span class="check">✓</span>' : curr ? '<span class="arrow">▶</span>' : '<span class="lock">○</span>';
        return `<tr class="${cls}"><td>${m.n}</td><td>${m.label}</td><td>${m.doublings}×</td><td>${icon}</td></tr>`;
      }).join('');
    }

    // Compound rows
    const crow = el('compoundRows');
    if (crow) {
      crow.innerHTML = CFG.MILESTONES.slice(0, 8).map(m => {
        const reached  = STATE.capital >= m.cap;
        const pctFill  = Math.min(100, STATE.capital / m.cap * 100).toFixed(0);
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--b);font-size:12px">
          <div style="font-family:var(--mono);font-size:10px;color:var(--muted2);width:80px;flex-shrink:0">${m.label}</div>
          <div style="flex:1;height:5px;background:var(--s3);border-radius:3px;overflow:hidden">
            <div style="width:${pctFill}%;height:100%;border-radius:3px;background:${reached?'var(--g)':'var(--xrp)'}"></div>
          </div>
          <div style="font-family:var(--mono);font-size:11px;font-weight:600;width:90px;text-align:right;color:${reached?'var(--g)':'var(--muted2)'}">
            ${reached?'✓ LOGRADO':'$'+fmt(STATE.capital)}
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── Balance ──
  function renderBalance(bals) {
    const panel = el('balancePanel');
    if (!panel) return;
    const show = bals.filter(b => parseFloat(b.total) > 0);
    const colors = { usdc:'var(--bl)', btc:'var(--a)', xrp:'var(--xrp)', eth:'var(--pu)', sol:'var(--g)', mxn:'var(--g)' };
    panel.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">` +
      show.map(b => {
        const cur = b.currency.toLowerCase();
        const tot = parseFloat(b.total);
        const avl = parseFloat(b.available);
        return `<div style="background:var(--s2);border:1px solid var(--b);border-radius:7px;padding:10px 12px">
          <div style="font-family:var(--mono);font-size:8px;color:${colors[cur]||'var(--text)'};letter-spacing:2px;margin-bottom:4px">${b.currency.toUpperCase()}</div>
          <div style="font-family:var(--mono);font-size:16px;font-weight:600">${tot < 0.01 ? tot.toFixed(6) : fmt(tot)}</div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--muted2);margin-top:3px">Disp: ${avl < 0.01 ? avl.toFixed(6) : fmt(avl)}</div>
        </div>`;
      }).join('') + '</div>';
  }

  function renderOpenOrders(orders) {
    const card = el('openOrdersCard');
    const list = el('openOrdersList');
    if (!card || !list) return;
    card.style.display = 'block';
    if (!orders.length) {
      list.innerHTML = '<div style="font-family:var(--mono);font-size:11px;color:var(--muted2)">No hay órdenes abiertas.</div>';
      return;
    }
    list.innerHTML = orders.map(o => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--s2);border-radius:6px;margin-bottom:6px;font-family:var(--mono);font-size:10px">
        <span style="color:${o.side==='buy'?'var(--g)':'var(--r)'}">${o.side.toUpperCase()}</span>
        <span>${parseFloat(o.original_amount).toFixed(4)} ${o.book.split('_')[0].toUpperCase()}</span>
        <span style="color:var(--a)">@ $${parseFloat(o.price||0).toFixed(4)}</span>
        <span style="color:var(--muted2)">${o.status}</span>
        <button onclick="UI.cancelOrder('${o.oid}')" style="background:rgba(255,59,80,.15);border:1px solid rgba(255,59,80,.3);color:var(--r);font-family:var(--mono);font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer">✕</button>
      </div>`).join('');
  }

  async function cancelOrder(oid) {
    try {
      await API.cancelOrder(oid);
      const orders = await API.getOpenOrders(STATE.params.activePair);
      if (orders.success) renderOpenOrders(orders.payload);
    } catch (e) {}
  }

  // ── Status ──
  function setBotStatus(on) {
    const dot = el('botDot');
    const txt = el('botTxt');
    const btn = el('btnToggle');
    if (dot) { dot.className = 'status-dot ' + (on ? 'on' : 'off'); }
    if (txt) txt.textContent = on ? 'BOT 24/7 ACTIVO' : 'BOT PAUSADO';
    if (btn) btn.textContent = on ? '⏸ PAUSAR' : '▶ ACTIVAR';
  }

  function setWsStatus(ok, msg) {
    const dot   = el('wsDot');
    const txt   = el('wsStatus');
    const badge = el('wsBadge');
    if (dot) dot.style.background = ok ? 'var(--g)' : 'var(--a)';
    if (txt) txt.textContent = msg;
    if (badge) { badge.textContent = ok ? 'WS LIVE' : 'SIMULADO'; badge.style.color = ok ? 'var(--g)' : 'var(--a)'; }
  }

  function setApiStatus(connected) {
    const dot = el('apiDot');
    const txt = el('apiConnTxt');
    if (dot) { dot.style.background = connected ? 'var(--g)' : 'var(--muted)'; dot.style.boxShadow = connected ? '0 0 8px var(--g)' : 'none'; }
    if (txt) { txt.textContent = connected ? 'CONECTADO' : 'DESCONECTADO'; txt.style.color = connected ? 'var(--g)' : 'var(--muted2)'; }
  }

  function showApiMsg(msg, type) {
    const e = el('apiMsg');
    if (!e) return;
    e.style.display = 'block';
    e.textContent   = msg;
    e.style.whiteSpace = 'pre-line';
    const styles = {
      success: 'rgba(0,204,122,0.08);color:#60e8aa;border:1px solid rgba(0,204,122,0.25)',
      error:   'rgba(255,59,80,0.08);color:#ff8fa0;border:1px solid rgba(255,59,80,0.25)',
      info:    'rgba(61,142,240,0.08);color:#80b8ff;border:1px solid rgba(61,142,240,0.25)',
      warn:    'rgba(245,160,32,0.08);color:#f5c060;border:1px solid rgba(245,160,32,0.25)',
    };
    e.style.cssText += ';background:' + styles[type] + ';padding:10px 12px;border-radius:6px;margin-top:8px';
  }

  // ── Notificación flotante ──
  function showNotif(msg, type = 'info') {
    const colors = { success:'var(--g)', error:'var(--r)', warn:'var(--a)', info:'var(--bl)' };
    const notif  = document.createElement('div');
    notif.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:9999;
      background:var(--s1);border:1px solid ${colors[type]||'var(--b)'};
      border-radius:8px;padding:12px 16px;
      font-family:var(--mono);font-size:11px;color:${colors[type]||'var(--text)'};
      max-width:320px;line-height:1.6;
      animation:fadeUp .3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.4);
    `;
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  // ── Tab navigation ──
  function showTab(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const page = el('page-' + name);
    const tab  = el('tab-' + name);
    if (page) page.classList.add('active');
    if (tab)  tab.classList.add('active');
  }

  // ── Calculadora de proyección ──
  function calcProjection() {
    const cap   = parseInt(el('cCapital').value);
    const rend  = parseInt(el('cRend').value) / 100;
    const meses = parseInt(el('cMeses').value);
    const aport = parseInt(el('cAport').value);
    set('oCapital', '$' + cap.toLocaleString());
    set('oRend',    Math.round(rend * 100) + '%');
    set('oMeses',   meses + ' meses');
    set('oAport',   '$' + aport);

    let total = cap;
    for (let m = 0; m < meses; m++) total = total * (1 + rend) + aport;
    total = Math.round(total);
    const ganancia = total - cap - aport * meses;
    const roi      = Math.round(ganancia / cap * 100);

    set('rFinal',    '$' + total.toLocaleString());
    set('rGanancia', '$' + Math.max(0, Math.round(ganancia)).toLocaleString());
    set('rROI',      roi + '%');

    const phases = ['', 'Fase 1 (Semilla)', 'Fase 2 (Arranque)', 'Fase 3 (Crecimiento)', 'Fase 4 (Escala)', 'Fase 5 (Profesional)'];
    const ph = detectPhase(total);
    set('rPhase', `Con $${total.toLocaleString()} USDC estarías en ${phases[ph]}`);
  }

  // ── Preview de orden ──
  function updateOrderPreview() {
    const book  = (el('orderBook')?.value)  || 'xrp_usdc';
    const side  = (el('orderSide')?.value)  || 'buy';
    const type  = (el('orderType')?.value)  || 'limit';
    const amt   = parseFloat(el('orderAmt')?.value) || 0;
    const price = parseFloat(el('orderPrice')?.value) || STATE.prices[book]?.last || 1;
    const feeR  = type === 'limit' ? CFG.FEE_MAKER : CFG.FEE_TAKER;
    const xrpQ  = (amt / price).toFixed(6);
    const fee   = (amt * feeR).toFixed(4);
    const tp    = (price * (1 + STATE.params.slPct * 2.5 / 100)).toFixed(6);
    const sl    = (price * (1 - STATE.params.slPct / 100)).toFixed(6);
    const prev  = el('orderPreview');
    if (prev) {
      prev.textContent =
        `Par: ${book.toUpperCase()}  Dir: ${side.toUpperCase()}  Tipo: ${type.toUpperCase()}\n` +
        `Precio: $${price.toFixed(6)}  Cantidad: ${xrpQ}  Monto: $${amt.toFixed(2)} USDC\n` +
        `Fee (${(feeR*100).toFixed(2)}%): $${fee} USDC\n` +
        `TP sugerido: $${tp} (+${(STATE.params.slPct*2.5).toFixed(1)}%)  SL: $${sl} (-${STATE.params.slPct}%)`;
    }
  }

  return {
    updateTicker, updateTopbarBTC, refreshAllTickers,
    updateOrderBook, updateOrderBookSim,
    updateSignals, updateMOS, updateRegime, updateRiskPanel,
    drawGauge, addTradeRow, updateAllMetrics, updateGoal,
    renderBalance, renderOpenOrders, cancelOrder,
    setBotStatus, setWsStatus, setApiStatus,
    showApiMsg, showNotif, showTab,
    calcProjection, updateOrderPreview,
  };
})();
