# 🤖 Bitso Trading Bot 24/7
### $91 USDC → Meta $1,000,000 · Estrategia Escalonada México

Bot de trading automatizado para Bitso con dashboard en tiempo real, operaciones 24/7 y plan escalonado en 5 fases.

---

## 🚀 Deploy en GitHub Pages (3 pasos)

### Paso 1 — Fork o sube el repositorio
```bash
git init
git add .
git commit -m "Bitso Bot inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/bitso-bot.git
git push -u origin main
```

### Paso 2 — Activar GitHub Pages
1. Ve a tu repo en GitHub
2. **Settings → Pages**
3. Source: **Deploy from branch**
4. Branch: **main** / folder: **/ (root)**
5. Guardar → esperar 2 minutos

### Paso 3 — Abrir el bot
```
https://TU_USUARIO.github.io/bitso-bot
```

¡Listo! Desde GitHub Pages **no hay error CORS** y la API de Bitso funciona al 100%.

---

## 🔑 Conectar tu cuenta Bitso

1. Entra a [bitso.com](https://bitso.com) → **Cuenta → API Keys**
2. Crear nueva key → activar **solo "Trading"** (sin retiros)
3. En el bot → pestaña **API BITSO** → ingresar Key y Secret
4. Pulsar **CONECTAR** → el bot detecta tu balance real automáticamente

---

## 📁 Estructura del proyecto

```
bitso-bot/
├── index.html          ← Dashboard principal (punto de entrada)
├── README.md           ← Este archivo
├── css/
│   └── style.css       ← Estilos del bot
└── js/
    ├── config.js       ← Configuración global y constantes
    ├── api.js          ← Conexión Bitso API + WebSocket
    ├── engine.js       ← Motor de señales, MOS, régimen
    ├── bot.js          ← Lógica de trading automático
    ├── portfolio.js    ← Gestión del portafolio y capital
    ├── ui.js           ← Actualización del dashboard
    └── charts.js       ← Gráficas de precio y equity
```

---

## ⚙️ Estrategias implementadas

| Estrategia | Fase | Par | Descripción |
|---|---|---|---|
| DCA Semanal | 1+ | BTC/USDC | Compra fija cada semana |
| Swing S/R | 1+ | XRP/USDC | Soporte $1.30–$1.50 / Resistencia $1.62–$1.82 |
| EMA 9/21 Crossover | 2+ | XRP, ETH | Cruz alcista/bajista en 1h |
| RSI Oversold Bounce | 2+ | Todos | RSI < 30 rebote confirmado |
| Bollinger Squeeze | 3+ | XRP, SOL | Ruptura después de compresión |
| Grid Trading | 3+ | XRP/USDC | 10 niveles automáticos |
| Ensemble MTF | Todas | Todos | 4 timeframes confirman señal |

---

## 📊 Fases del plan

| Fase | Capital | Estrategia principal |
|---|---|---|
| 1 · Semilla | $50–$500 | DCA + Swing básico XRP |
| 2 · Arranque | $500–$2K | EMA + RSI + 3 activos |
| 3 · Crecimiento | $2K–$15K | Grid + Bollinger + 5 activos |
| 4 · Escala | $15K–$100K | Bitso Alpha + ETFs + Bot API |
| 5 · Profesional | $100K+ | Institucional + retiro mensual |

---

## ⚠️ Aviso legal

- Este bot opera en **modo paper por defecto**
- Las criptomonedas son activos de **alto riesgo**
- Operación legal en México bajo **Ley Fintech / CNBV**
- Reportar ganancias al **SAT** (actividad empresarial)
- **No inviertas dinero que necesites**

---

## 🛡️ Seguridad

- Las API Keys se guardan en `localStorage` de tu navegador
- Nunca se envían a ningún servidor externo
- Usar **solo permisos de Trading** en Bitso (sin retiros)
- GitHub Pages sirve el HTML estático sin backend

---

*Desarrollado para operadores en México · Bitso API v3 · Marzo 2026*
