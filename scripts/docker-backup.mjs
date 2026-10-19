import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const directory = path.resolve(".haneul", "backups");
await mkdir(directory, { recursive: true });
const filename = `haneul-docker-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
const containerFile = `/tmp/${filename}`;
function compose(args) {
  const result = spawnSync("docker", ["compose", "--env-file", ".env.docker", ...args], { stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) throw new Error("Backup failed. Check Docker Desktop and the database container.");
}
compose(["exec", "-T", "db", "pg_dump", "-U", "postgres", "-d", "haneul", "-Fc", "-f", containerFile]);
compose(["cp", `db:${containerFile}`, path.join(directory, filename)]);
console.log(`Database backup saved: ${path.join(directory, filename)}`);
console.log("Also keep a copy of .haneul/courses, import-jobs, mcp-events and worksheet stores; these are filesystem data.");
