// ═══════════════════════════════════════════════════════
//  api.js — Conexión Bitso API v3 + WebSocket
//  Sin CORS desde GitHub Pages (dominio permitido)
// ═══════════════════════════════════════════════════════

const API = (() => {
  let ws = null;
  let wsRetries = 0;
  let wsConnected = false;

  // ── HMAC-SHA256 (Web Crypto API — nativo en browsers modernos) ──
  async function sign(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Request autenticado ──
  async function request(method, endpoint, body = null) {
    const nonce   = Date.now().toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const sig     = await sign(
      STATE.apiSecret,
      nonce + method.toUpperCase() + endpoint + bodyStr
    );
    const opts = {
      method,
      headers: {
        'Authorization': `Bitso ${STATE.apiKey}:${nonce}:${sig}`,
        'Content-Type': 'application/json',
      },
    };
    if (bodyStr) opts.body = bodyStr;
    const res = await fetch(CFG.API_BASE + endpoint, opts);
    return res.json();
  }

  // ── Request público (sin auth) ──
  async function pub(endpoint) {
    const res = await fetch(CFG.API_BASE + endpoint);
    return res.json();
  }

  // ─────────────────────────────────────────
  // WEBSOCKET — datos en tiempo real
  // ─────────────────────────────────────────
  function connectWS() {
    try {
      ws = new WebSocket(CFG.WS_URL);

      ws.onopen = () => {
        wsRetries   = 0;
        wsConnected = true;
        UI.setWsStatus(true, 'WebSocket · Bitso · en vivo');

        // Suscribir a todos los pares activos
        const subs = ['xrp_usdc', 'btc_usdc', 'eth_usdc', 'sol_usdc'];
        subs.forEach(book => {
          ws.send(JSON.stringify({ action: 'subscribe', book, type: 'trades' }));
          ws.send(JSON.stringify({ action: 'subscribe', book, type: 'diff-orders' }));
        });
      };

      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (!d.payload || !d.book) return;

          // Actualizar precio desde trades en vivo
          if (d.type === 'trades' && d.payload.length > 0) {
            const t     = d.payload[d.payload.length - 1];
            const price = parseFloat(t.r);
            if (price > 0 && STATE.prices[d.book]) {
              const old = STATE.prices[d.book].last;
              STATE.prices[d.book].last = price;
              if (price > STATE.prices[d.book].high) STATE.prices[d.book].high = price;
              if (price < STATE.prices[d.book].low)  STATE.prices[d.book].low  = price;
              UI.updateTicker(d.book, price, old);
              CHARTS.addPricePoint(d.book, price);
            }
          }

          // Order book en tiempo real
          if (d.type === 'diff-orders' && d.book === STATE.params.activePair) {
            UI.updateOrderBook(d.payload);
          }
        } catch (ex) {}
      };

      ws.onclose = () => {
        wsConnected = false;
        UI.setWsStatus(false, `WS desconectado · reconectando (${wsRetries + 1})...`);
        wsRetries++;
        setTimeout(connectWS, Math.min(CFG.ENGINE.WS_RECONNECT * wsRetries, 30000));
      };

      ws.onerror = () => {
        wsConnected = false;
        UI.setWsStatus(false, 'WS error · modo simulado activo');
      };
    } catch (e) {
      UI.setWsStatus(false, 'WS no disponible · simulando precios');
    }
  }

  function isWSConnected() { return wsConnected; }

  // ─────────────────────────────────────────
  // ENDPOINTS PÚBLICOS
  // ─────────────────────────────────────────

  // Ticker en tiempo real (sin auth)
  async function getTicker(book) {
    return pub(`/ticker/?book=${book}`);
  }

  // Order book completo (sin auth)
  async function getOrderBook(book) {
    return pub(`/order_book/?book=${book}&aggregate=true`);
  }

  // Trades recientes (sin auth)
  async function getTrades(book, limit = 30) {
    return pub(`/trades/?book=${book}&limit=${limit}`);
  }

  // Cargar precios reales al inicio
  async function loadAllTickers() {
    const books = Object.keys(STATE.prices);
    const results = await Promise.allSettled(
      books.map(b => getTicker(b))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.success) {
        const t   = r.value.payload;
        const bk  = books[i];
        STATE.prices[bk].last = parseFloat(t.last);
        STATE.prices[bk].open = parseFloat(t.open || t.last);
        STATE.prices[bk].high = parseFloat(t.high);
        STATE.prices[bk].low  = parseFloat(t.low);
        STATE.prices[bk].vol  = parseFloat(t.volume);
      }
    });
    UI.refreshAllTickers();
    return true;
  }

  // ─────────────────────────────────────────
  // ENDPOINTS AUTENTICADOS
  // ─────────────────────────────────────────

  async function getBalance() {
    return request('GET', '/balance/');
  }

  async function getOpenOrders(book = 'xrp_usdc') {
    return request('GET', `/open_orders/?book=${book}`);
  }

  async function placeOrder({ book, side, type, major, price }) {
    const body = { book, side, type, major: String(major) };
    if (type === 'limit' && price) body.price = String(price);
    return request('POST', '/orders/', body);
  }

  async function cancelOrder(oid) {
    return request('DELETE', `/orders/${oid}`);
  }

  async function cancelAllOrders() {
    return request('DELETE', '/orders/all');
  }

  // ─────────────────────────────────────────
  // CONEXIÓN Y VERIFICACIÓN
  // ─────────────────────────────────────────

  async function connect(apiKey, apiSecret) {
    STATE.apiKey    = apiKey;
    STATE.apiSecret = apiSecret;
    localStorage.setItem('bb_k', apiKey);
    localStorage.setItem('bb_s', apiSecret);

    UI.showApiMsg('Verificando credenciales con Bitso...', 'info');
    try {
      const d = await getBalance();
      if (d.success) {
        STATE.connected = true;
        UI.setApiStatus(true);
        UI.renderBalance(d.payload.balances);

        // Actualizar capital desde USDC real
        const usdc = d.payload.balances.find(b => b.currency === 'usdc');
        if (usdc) {
          const real = parseFloat(usdc.available);
          STATE.capital      = real;
          STATE.startCapital = real;
          STATE.phase        = detectPhase(real);
          UI.updateAllMetrics();
          UI.updateGoal();
        }

        // Cargar órdenes abiertas
        const orders = await getOpenOrders(STATE.params.activePair);
        if (orders.success) UI.renderOpenOrders(orders.payload);

        UI.showApiMsg(
          `✓ Conectado correctamente\nBalance USDC: $${
            parseFloat(d.payload.balances.find(b=>b.currency==='usdc')?.total||0).toFixed(2)
          }\nModo: ${STATE.mode === 'live' ? 'OPERACIONES REALES' : 'PAPER TRADING'}`,
          'success'
        );
        return true;
      } else {
        UI.showApiMsg(
          'Error de autenticación:\n' + (d.error?.message || JSON.stringify(d.error)) +
          '\n\nVerifica que tu API Key tenga permiso de Trading.',
          'error'
        );
        return false;
      }
    } catch (e) {
      UI.showApiMsg(
        '✗ Error de conexión:\n' + e.message +
        '\n\nSi ves este error en GitHub Pages, verifica que:\n' +
        '1. Tu API Key sea correcta\n' +
        '2. Tengas permiso de Trading en Bitso\n' +
        '3. No hayas expirado la key',
        'error'
      );
      return false;
    }
  }

  function disconnect() {
    STATE.apiKey    = '';
    STATE.apiSecret = '';
    STATE.connected = false;
    localStorage.removeItem('bb_k');
    localStorage.removeItem('bb_s');
    UI.setApiStatus(false);
    UI.showApiMsg('Desconectado. Keys eliminadas del navegador.', 'info');
  }

  function loadSavedKeys() {
    const k = localStorage.getItem('bb_k');
    const s = localStorage.getItem('bb_s');
    if (k && s) {
      document.getElementById('apiKey').value    = k;
      document.getElementById('apiSecret').value = s;
      STATE.apiKey    = k;
      STATE.apiSecret = s;
      // Auto-conectar al cargar
      connect(k, s).then(ok => {
        if (ok) UI.showApiMsg('✓ Reconexión automática exitosa', 'success');
      });
    }
  }

  // Exponer módulo
  return {
    connectWS, isWSConnected,
    getTicker, getOrderBook, getTrades, loadAllTickers,
    getBalance, getOpenOrders,
    placeOrder, cancelOrder, cancelAllOrders,
    connect, disconnect, loadSavedKeys,
  };
})();
