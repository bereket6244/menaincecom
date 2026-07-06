let app = null;
let loadError = null;

const appReady = import('./src/index.mjs')
  .then((mod) => {
    app = mod.default || mod.app;
    if (mod.start) return mod.start().then(() => mod);
    return mod;
  })
  .catch((err) => {
    loadError = err;
    console.error('[startup] failed to load app:', err && (err.stack || err.message) ? (err.stack || err.message) : err);
    throw err;
  });

function passengerApp(req, res) {
  if (app) {
    return app(req, res);
  }

  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(JSON.stringify({
    error: 'app_starting',
    message: loadError ? 'The storefront failed to start.' : 'The storefront is starting.',
  }));
}

module.exports = passengerApp;

if (require.main === module) {
  appReady.catch(() => {
    process.exitCode = 1;
  });
}
