import { createClient } from 'redis';
import { Pool } from 'pg';

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
export const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'root',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'flowzint',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ─── Redis ────────────────────────────────────────────────────────────────────
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// ─── Initialize Schema ────────────────────────────────────────────────────────
export async function initDB() {
  try {
    // Attempt DB connections — gracefully skip if unavailable (for dev without Docker)
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        subject TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        description TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await redisClient.connect();
    console.log('✅ PostgreSQL and Redis connected.');
  } catch (err) {
    console.warn('⚠️  DB not available — running in memory mode:', (err as Error).message);
  }
}
