// ═══════════════════════════════════════════════════════
//  charts.js — Gráficas con Chart.js
// ═══════════════════════════════════════════════════════

const CHARTS = (() => {
  const instances = {};
  const priceHistory = {};    // { book: [prices] }
  const equityHistory = [CFG.INITIAL_CAPITAL];
  const mosHistory    = [];

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
  };

  function gridColor() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(0,0,0,0.05)';
  }
  function tickColor() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? '#3a4a62'
      : '#9ca3af';
  }

  // ── Precio ──
  function initPriceChart(canvasId, book) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (instances[canvasId]) { instances[canvasId].destroy(); }

    // Seed con datos simulados
    if (!priceHistory[book]) priceHistory[book] = [];
    const p0 = STATE.prices[book]?.last || 1.47;
    for (let i = 60; i >= 0; i--) {
      priceHistory[book].push(p0 * (1 + (Math.random() - 0.499) * 0.008 * i / 10));
    }

    instances[canvasId] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels:   priceHistory[book].map((_, i) => i),
        datasets: [
          {
            data: [...priceHistory[book]],
            borderColor: '#00cc7a', borderWidth: 1.5,
            pointRadius: 0, fill: true,
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
              g.addColorStop(0, 'rgba(0,204,122,0.18)');
              g.addColorStop(1, 'rgba(0,204,122,0.00)');
              return g;
            },
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { display: false },
          y: {
            ticks: {
              color: tickColor(),
              font: { family: 'IBM Plex Mono', size: 9 },
              callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(4)),
            },
            grid: { color: gridColor() },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ' $' + c.parsed.y.toFixed(4) } },
        },
      },
    });
  }

  function addPricePoint(book, price) {
    if (!priceHistory[book]) priceHistory[book] = [];
    priceHistory[book].push(price);
    if (priceHistory[book].length > 120) priceHistory[book].shift();

    // Actualizar todas las gráficas de precio que existan
    ['priceCanvas', 'priceCanvas2'].forEach(id => {
      if (instances[id] && instances[id].data) {
        instances[id].data.labels = priceHistory[book].map((_, i) => i);
        instances[id].data.datasets[0].data = [...priceHistory[book]];
        instances[id].update('none');
      }
    });
  }

  // ── Equity curve ──
  function initEquityChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (instances[canvasId]) instances[canvasId].destroy();

    // Curva proyectada
    const projected = Array.from({ length: 60 }, (_, i) =>
      parseFloat((CFG.INITIAL_CAPITAL * Math.pow(1.08, i)).toFixed(2))
    );

    instances[canvasId] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array.from({ length: 60 }, (_, i) => 'T' + i),
        datasets: [
          {
            label: 'Real',
            data: [...equityHistory],
            borderColor: '#3d8ef0', borderWidth: 2,
            pointRadius: 0, fill: false,
          },
          {
            label: 'Proyectado (+8%/mes)',
            data: projected,
            borderColor: '#8b5cf6', borderWidth: 1,
            pointRadius: 0, fill: false,
            borderDash: [4, 4],
          },
        ],
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          legend: {
            display: true,
            labels: { color: tickColor(), font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 12 },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor(), font: { size: 9 }, maxTicksLimit: 8 },
            grid: { color: gridColor() },
          },
          y: {
            type: 'logarithmic',
            ticks: {
              color: tickColor(), font: { size: 9 },
              callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0)),
            },
            grid: { color: gridColor() },
          },
        },
      },
    });
  }

  function addEquityPoint(capital) {
    equityHistory.push(parseFloat(capital.toFixed(2)));
    if (equityHistory.length > 200) equityHistory.shift();
    ['equityCanvas', 'equityCanvas2'].forEach(id => {
      if (instances[id]) {
        instances[id].data.datasets[0].data = [...equityHistory];
        instances[id].data.labels = equityHistory.map((_, i) => 'T' + i);
        instances[id].update('none');
      }
    });
  }

  // ── MOS histórico ──
  function initMOSChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (instances[canvasId]) instances[canvasId].destroy();

    // Seed
    for (let i = 0; i < 24; i++) mosHistory.push(35 + Math.random() * 55);

    instances[canvasId] = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: mosHistory.map((_, i) => i + 'h'),
        datasets: [{
          data: [...mosHistory],
          backgroundColor: mosHistory.map(v =>
            v > 60 ? 'rgba(0,204,122,0.65)'
            : v > 30 ? 'rgba(245,160,32,0.65)'
            : 'rgba(255,59,80,0.65)'
          ),
          borderRadius: 2,
        }],
      },
      options: {
        ...CHART_DEFAULTS,
        scales: {
          x: { ticks: { color: tickColor(), font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: gridColor() } },
          y: { min: 0, max: 100, ticks: { color: tickColor(), font: { size: 9 } }, grid: { color: gridColor() } },
        },
      },
    });
  }

  function addMOSPoint(mos) {
    mosHistory.push(mos);
    if (mosHistory.length > 48) mosHistory.shift();
    if (instances['mosChart']) {
      instances['mosChart'].data.labels = mosHistory.map((_, i) => i + 'h');
      instances['mosChart'].data.datasets[0].data = [...mosHistory];
      instances['mosChart'].data.datasets[0].backgroundColor = mosHistory.map(v =>
        v > 60 ? 'rgba(0,204,122,0.65)' : v > 30 ? 'rgba(245,160,32,0.65)' : 'rgba(255,59,80,0.65)'
      );
      instances['mosChart'].update('none');
    }
  }

  function initAll() {
    initPriceChart('priceCanvas', STATE.params.activePair);
    initEquityChart('equityCanvas');
    initMOSChart('mosChart');
  }

  return { initAll, initPriceChart, initEquityChart, initMOSChart, addPricePoint, addEquityPoint, addMOSPoint };
})();
