import { access, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const destination = ".env.docker";
try {
  await access(destination);
  console.log(".env.docker already exists; keeping its credentials and settings.");
} catch {
  let local = "";
  try { local = await readFile(".env.local", "utf8"); process.loadEnvFile(".env.local"); } catch { /* Fresh checkout. */ }
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const appPassword = url ? decodeURIComponent(url.password) : randomBytes(24).toString("base64url");
  const adminPassword = process.env.POSTGRES_ADMIN_PASSWORD || randomBytes(24).toString("base64url");
  const kept = local.split(/\r?\n/).filter(line => !/^\s*(?:DATABASE_URL|POSTGRES_ADMIN_PASSWORD|POSTGRES_PASSWORD|HANEUL_DB_PASSWORD|HANEUL_DOCKER_DATABASE_URL|HANEUL_WEB_PORT|HANEUL_DB_PORT)\s*=/.test(line)).join("\n");
  const databaseUrl = `postgresql://haneul_app:${encodeURIComponent(appPassword)}@db:5432/haneul`;
  await writeFile(destination, `${kept}\nPOSTGRES_PASSWORD=${JSON.stringify(adminPassword)}\nHANEUL_DB_PASSWORD=${JSON.stringify(appPassword)}\nHANEUL_DOCKER_DATABASE_URL=${databaseUrl}\nHANEUL_WEB_PORT=3000\nHANEUL_DB_PORT=5432\n`, { mode: 0o600, flag: "wx" });
  console.log("Created private .env.docker. Existing API/MCP settings retained; credentials were not printed.");
}
