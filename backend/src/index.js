require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const { initDB }           = require('./db');
const { startProxyServer } = require('./proxy-server');
const authMiddleware       = require('./middleware/auth');

const authRouter     = require('./routes/auth');
const settingsRouter = require('./routes/settings');
const proxiesRouter  = require('./routes/proxies');
const logsRouter     = require('./routes/logs');
const devicesRouter  = require('./routes/devices');
const statsRouter    = require('./routes/stats');

const { runBackgroundSync } = require('./routes/proxies');

const app      = express();
const API_PORT = parseInt(process.env.API_PORT || '3000');

// Auto-sync interval (minutes). Set to 0 to disable.
const SYNC_INTERVAL_MIN = parseInt(process.env.SYNC_INTERVAL_MINUTES || '30');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

app.use(authMiddleware);

app.use('/api/auth',     authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/proxies',  proxiesRouter);
app.use('/api/logs',     logsRouter);
app.use('/api/devices',  devicesRouter);
app.use('/api/stats',    statsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function main() {
  try {
    await initDB();
    startProxyServer();
    app.listen(API_PORT, '0.0.0.0', () => {
      console.log(`[api] Listening on port ${API_PORT}`);
    });

    // Background proxy sync scheduler
    if (SYNC_INTERVAL_MIN > 0) {
      const ms = SYNC_INTERVAL_MIN * 60_000;
      console.log(`[auto-sync] Scheduled every ${SYNC_INTERVAL_MIN} min`);
      setInterval(() => {
        console.log('[auto-sync] Starting scheduled proxy metadata sync…');
        runBackgroundSync().catch(err => console.error('[auto-sync] Error:', err.message));
      }, ms);
    } else {
      console.log('[auto-sync] Disabled (SYNC_INTERVAL_MINUTES=0)');
    }
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

main();
