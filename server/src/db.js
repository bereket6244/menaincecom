import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const localStorePath = path.resolve('dev-data.json');
let useLocalStore = process.env.USE_LOCAL_STORE === 'true';

export function isUsingLocalStore() {
  return useLocalStore;
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mena_inc',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

export async function ensureSchema() {
  if (useLocalStore) {
    await readLocalStore();
    console.warn('[db] using local dev-data.json store');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_records (
        id CHAR(36) NOT NULL PRIMARY KEY,
        collection VARCHAR(64) NOT NULL,
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_collection (collection)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    useLocalStore = true;
    await readLocalStore();
    console.warn('[db] MySQL unavailable; using local dev-data.json store');
  }
}

function rowToDoc(row) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return {
    ...data,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDbUnavailable(err) {
  return err && (
    err.code?.startsWith?.('ER_') ||
    ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ENOTFOUND'].includes(err.code)
  );
}

async function readLocalStore() {
  try {
    return JSON.parse(await fs.readFile(localStorePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return {};
  }
}

async function writeLocalStore(store) {
  await fs.writeFile(localStorePath, JSON.stringify(store, null, 2));
}

function localDoc(doc) {
  return { ...doc, id: doc.id, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

async function mutateLocalStore(mutator) {
  const store = await readLocalStore();
  const result = await mutator(store);
  await writeLocalStore(store);
  return result;
}

export const records = {
  async list(collection) {
    if (useLocalStore) {
      const store = await readLocalStore();
      return (store[collection] || [])
        .map(localDoc)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    const [rows] = await pool.query(
      'SELECT * FROM app_records WHERE collection = ? ORDER BY created_at DESC',
      [collection]
    );
    return rows.map(rowToDoc);
  },

  async get(collection, id) {
    if (useLocalStore) {
      const store = await readLocalStore();
      const doc = (store[collection] || []).find((item) => item.id === id);
      return doc ? localDoc(doc) : null;
    }

    const [rows] = await pool.query(
      'SELECT * FROM app_records WHERE collection = ? AND id = ? LIMIT 1',
      [collection, id]
    );
    return rows.length ? rowToDoc(rows[0]) : null;
  },

  async find(collection, predicate) {
    const all = await this.list(collection);
    return all.find(predicate) || null;
  },

  async insert(collection, data) {
    const id = crypto.randomUUID();
    if (useLocalStore) {
      return mutateLocalStore((store) => {
        const now = new Date().toISOString();
        const doc = { ...data, id, createdAt: now, updatedAt: now };
        store[collection] ||= [];
        store[collection].push(doc);
        return localDoc(doc);
      });
    }

    await pool.query(
      'INSERT INTO app_records (id, collection, data) VALUES (?, ?, ?)',
      [id, collection, JSON.stringify({ ...data, id })]
    );
    return this.get(collection, id);
  },

  async update(collection, id, patch) {
    if (useLocalStore) {
      return mutateLocalStore((store) => {
        const items = store[collection] || [];
        const index = items.findIndex((item) => item.id === id);
        if (index === -1) return null;
        const next = { ...items[index], ...patch, id, updatedAt: new Date().toISOString() };
        items[index] = next;
        return localDoc(next);
      });
    }

    const existing = await this.get(collection, id);
    if (!existing) return null;
    const { createdAt, updatedAt, ...doc } = existing;
    const next = { ...doc, ...patch, id };
    await pool.query(
      'UPDATE app_records SET data = ? WHERE collection = ? AND id = ?',
      [JSON.stringify(next), collection, id]
    );
    return this.get(collection, id);
  },

  async remove(collection, id) {
    if (useLocalStore) {
      return mutateLocalStore((store) => {
        const before = store[collection] || [];
        store[collection] = before.filter((item) => item.id !== id);
        return before.length !== store[collection].length;
      });
    }

    const [res] = await pool.query(
      'DELETE FROM app_records WHERE collection = ? AND id = ?',
      [collection, id]
    );
    return res.affectedRows > 0;
  },
};

/** Wrap an async route handler; MySQL failures become a 503 the client understands. */
export function dbRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (isDbUnavailable(err)) {
        console.error('[db] unavailable:', err.code);
        return res.status(503).json({ error: 'db_unavailable', message: 'Database connection failed.' });
      }
      console.error('[api] error:', err);
      res.status(500).json({ error: 'server_error', message: 'Unexpected server error.' });
    }
  };
}
