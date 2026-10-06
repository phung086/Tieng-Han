import { Pool, type QueryResultRow } from "pg";

type GlobalDb = typeof globalThis & {
  __haneulPgPool?: Pool;
};

const globalDb = globalThis as GlobalDb;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Run Haneul in local-only mode or configure PostgreSQL.",
    );
  }

  return new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 12 : 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export function getDbPool() {
  if (!globalDb.__haneulPgPool) {
    globalDb.__haneulPgPool = createPool();
  }
  return globalDb.__haneulPgPool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getDbPool().query<T>(text, params);
}
