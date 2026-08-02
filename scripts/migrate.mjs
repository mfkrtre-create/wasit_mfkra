import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

async function loadEnvFile(filename) {
  const envPath = join(process.cwd(), filename);
  if (!existsSync(envPath)) {
    return;
  }

  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

await loadEnvFile(".env.local");
await loadEnvFile(".env.production");

const migrations = ["202608020001_server_auth.sql"];
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("Database migrations skipped: DATABASE_URL is not configured.");
  process.exit(0);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of migrations) {
    const alreadyApplied = await client.query("select 1 from public.schema_migrations where version = $1", [migration]);
    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      console.log(`Migration already applied: ${migration}`);
      continue;
    }

    const sql = await readFile(join(process.cwd(), "db", "migrations", migration), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations(version) values ($1) on conflict (version) do nothing", [migration]);
      await client.query("commit");
      console.log(`Migration applied: ${migration}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} catch (error) {
  console.error("Database migration failed.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
