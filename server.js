const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'subauditor.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost REAL NOT NULL,
    billing_cycle TEXT NOT NULL,
    renewal_date TEXT NOT NULL,
    status TEXT NOT NULL,
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_logs (
    id TEXT PRIMARY KEY,
    sent_at TEXT,
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const readState = db.transaction(() => ({
  initialized: db.prepare("SELECT value FROM app_metadata WHERE key = 'initialized'").get()?.value === 'true',
  subscriptions: db.prepare('SELECT data_json FROM subscriptions ORDER BY rowid').all().map(row => JSON.parse(row.data_json)),
  settings: db.prepare('SELECT data_json FROM app_settings WHERE id = 1').get()?.data_json,
  notificationLog: db.prepare('SELECT data_json FROM notification_logs ORDER BY rowid').all().map(row => JSON.parse(row.data_json))
}));

const writeState = db.transaction((state) => {
  db.prepare('DELETE FROM subscriptions').run();
  const insertSubscription = db.prepare(`
    INSERT INTO subscriptions (id, name, category, cost, billing_cycle, renewal_date, status, data_json)
    VALUES (@id, @name, @category, @cost, @billing_cycle, @renewal_date, @status, @data_json)
  `);
  for (const sub of state.subscriptions) {
    insertSubscription.run({
      id: sub.id,
      name: sub.name,
      category: sub.category,
      cost: Number(sub.cost),
      billing_cycle: sub.billingCycle,
      renewal_date: sub.renewalDate,
      status: sub.status,
      data_json: JSON.stringify(sub)
    });
  }

  db.prepare(`
    INSERT INTO app_settings (id, data_json) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json
  `).run(JSON.stringify(state.settings));

  db.prepare('DELETE FROM notification_logs').run();
  const insertLog = db.prepare('INSERT INTO notification_logs (id, sent_at, data_json) VALUES (?, ?, ?)');
  for (const entry of state.notificationLog) {
    insertLog.run(entry.id, entry.sentAt || null, JSON.stringify(entry));
  }
  db.prepare("INSERT INTO app_metadata (key, value) VALUES ('initialized', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'").run();
});

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function isValidState(state) {
  return state && Array.isArray(state.subscriptions) &&
    state.settings && typeof state.settings === 'object' &&
    Array.isArray(state.notificationLog) &&
    state.subscriptions.every(sub =>
      sub && typeof sub.id === 'string' && typeof sub.name === 'string' &&
      typeof sub.category === 'string' && Number.isFinite(Number(sub.cost)) &&
      typeof sub.billingCycle === 'string' && typeof sub.renewalDate === 'string' &&
      typeof sub.status === 'string'
    ) &&
    state.notificationLog.every(entry => entry && typeof entry.id === 'string');
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { status: 'ok', database: 'sqlite' });
  }
  if (requestUrl.pathname === '/api/data' && req.method === 'GET') {
    const state = readState();
    return sendJson(res, 200, {
      initialized: state.initialized,
      subscriptions: state.subscriptions,
      settings: state.settings ? JSON.parse(state.settings) : null,
      notificationLog: state.notificationLog
    });
  }
  if (requestUrl.pathname === '/api/data' && req.method === 'PUT') {
    try {
      const state = await readJson(req);
      if (!isValidState(state)) return sendJson(res, 400, { error: 'Invalid application data.' });
      writeState(state);
      return sendJson(res, 200, { saved: true });
    } catch (error) {
      console.error('SQLite write failed:', error);
      return sendJson(res, 400, { error: error.message });
    }
  }
  if (requestUrl.pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'API route not found.' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    return sendJson(res, 400, { error: 'Invalid URL path.' });
  }
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(res, error.code === 'ENOENT' ? 404 : 500, { error: 'File could not be served.' });
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`SubAuditor with SQLite listening at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
