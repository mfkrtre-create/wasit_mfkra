import "server-only";

import pg from "pg";

const { Pool } = pg;

declare global {
  var wasitDbPool: pg.Pool | undefined;
}

export function getDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return value;
}

export function getDb() {
  globalThis.wasitDbPool ??= new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  return globalThis.wasitDbPool;
}
