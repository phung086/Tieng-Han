import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async file => JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
const exists = file => access(file).then(() => true, () => false);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const contentDigest = value => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

export function parseOptions(args) {
  const options = { port: 3000, check: false, rebuild: false, dataDir: undefined };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--rebuild") options.rebuild = true;
    else if (arg === "--data-dir" && args[index + 1] && !args[index + 1].startsWith("--")) options.dataDir = args[++index];
    else if (arg === "--port" && args[index + 1]) options.port = Number(args[++index]);
    else throw new Error("Tham số không hợp lệ: " + arg);
  }
  if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error("Cổng phải nằm trong khoảng 1–65535.");
  return options;
}

export async function inspectLibrary(dataDir) {
  const directory = path.join(dataDir, "courses");
  const files = (await readdir(directory)).filter(name => name.endsWith(".json")).sort();
  if (!files.length) throw new Error("Thư viện chưa có khóa học: " + directory + ". Cần đồng bộ dữ liệu đã biên soạn trước khi mở ứng dụng.");
  const ids = new Set();
  const courses = [];
  for (const file of files) {
    const course = await readJson(path.join(directory, file));
    if (typeof course.id !== "string" || ids.has(course.id) || !Array.isArray(course.lessons) || !Array.isArray(course.questions)) throw new Error("Khóa học thiếu dữ liệu hoặc trùng ID: " + file);
    ids.add(course.id);
    const lessonIds = new Set();
    let vocabulary = 0, grammar = 0, examples = 0;
    const lessonsWithoutGrammar = [];
    for (const lesson of course.lessons) {
      if (!Number.isSafeInteger(lesson.id) || lesson.id < 1 || lessonIds.has(lesson.id) || !Array.isArray(lesson.vocabulary) || !Array.isArray(lesson.grammar)) throw new Error("Bài học thiếu dữ liệu hoặc trùng ID: " + file);
      lessonIds.add(lesson.id);
      vocabulary += lesson.vocabulary.length;
      grammar += lesson.grammar.length;
      if (!lesson.grammar.length) lessonsWithoutGrammar.push(lesson.id);
      for (const item of lesson.grammar) {
        if (typeof item.pattern !== "string" || typeof item.explanation !== "string" || !Array.isArray(item.examples) || item.examples.some(example => typeof example !== "string")) throw new Error("Ngữ pháp không hợp lệ: " + file + " · bài " + lesson.id);
        examples += item.examples.length;
      }
    }
    courses.push({ id: course.id, digest: contentDigest(course), title: course.title, lessons: course.lessons.length, vocabulary, grammar, examples, lessonsWithoutGrammar, coverage: course.source?.curriculumCoverage?.status ?? "unverified" });
  }
  return { courses, lessons: courses.reduce((n, course) => n + course.lessons, 0), grammar: courses.reduce((n, course) => n + course.grammar, 0) };
}

export function compareRuntimeLibrary(expected, runtimeCourses) {
  if (!Array.isArray(runtimeCourses)) throw new Error("API không trả thư viện khóa học hợp lệ.");
  const byId = new Map(runtimeCourses.map(course => [course.id, course]));
  const expectedIds = new Set(expected.courses.map(course => course.id));
  const missing = expected.courses.filter(course => !byId.has(course.id)).map(course => course.id);
  const changed = expected.courses.filter(course => byId.has(course.id) && contentDigest(byId.get(course.id)) !== course.digest).map(course => course.id);
  const extra = runtimeCourses.filter(course => !expectedIds.has(course.id)).map(course => course.id);
  return { complete: !missing.length && !changed.length && !extra.length && byId.size === runtimeCourses.length, missing, changed, extra };
}

async function verifyRuntime(url, expected) {
  const response = await fetch(url + "/api/courses", { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Không đọc được thư viện Haneul tại " + url);
  const result = compareRuntimeLibrary(expected, (await response.json()).courses);
  if (!result.complete) throw new Error("Máy chủ chưa dùng đúng toàn bộ dữ liệu. " + JSON.stringify(result));
  console.log("API đã đồng bộ nguyên vẹn mọi khóa, bài, ngữ pháp, ví dụ và câu hỏi với thư viện trên đĩa.");
}

/** Fingerprint real build inputs, including uncommitted/new app files. Private runtime data is separate. */
export async function sourceFingerprint(root) {
  const files = [];
  async function walk(directory) {
    if (!await exists(path.join(root, directory))) return;
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(relative);
      else if (entry.isFile()) files.push(relative);
    }
  }
  await walk("src"); await walk("public"); await walk("curriculum");
  const names = await readdir(root);
  for (const name of names) if (/^(package\.json|pnpm-lock\.yaml|tsconfig\.json|next\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s)$/.test(name)) files.push(name);
  const hash = createHash("sha256");
  for (const file of files.sort()) { hash.update(file.replaceAll(path.sep, "/") + "\0"); hash.update(await readFile(path.join(root, file))); }
  return hash.digest("hex");
}

function portInUse(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", error => error.code === "EADDRINUSE" ? resolve(true) : reject(error));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(false)));
  });
}

export async function runLocal(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const configFile = path.join(projectDir, ".haneul", "local-settings.json");
  const config = await exists(configFile) ? await readJson(configFile) : {};
  const dataDir = path.resolve(projectDir, options.dataDir ?? process.env.HANEUL_LOCAL_DATA_DIR ?? config.dataDir ?? ".haneul");
  const library = await inspectLibrary(dataDir);
  const fingerprint = await sourceFingerprint(projectDir);
  const version = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: projectDir, encoding: "utf8", windowsHide: true }).stdout?.trim() || "không có Git";
  const dirty = spawnSync("git", ["status", "--porcelain", "--", "src", "public", "curriculum", "package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json"], { cwd: projectDir, encoding: "utf8", windowsHide: true }).stdout?.trim();
  console.log("Code: " + projectDir + " · " + version + (dirty ? " · có thay đổi cục bộ" : ""));
  console.log("Dữ liệu: " + dataDir);
  console.table(library.courses.map(({ title, lessons, grammar, examples, coverage }) => ({ "Giáo trình": title, "Bài": lessons, "Ngữ pháp": grammar, "Ví dụ": examples, "Nguồn": coverage })));
  console.log(library.courses.length + " khóa · " + library.lessons + " bài · " + library.grammar + " mục ngữ pháp đã nhập. Không phải chứng nhận bao phủ đầy đủ sách.");
  const missing = library.courses.filter(course => course.lessonsWithoutGrammar.length);
  if (missing.length) console.log("Bài chưa có ngữ pháp: " + missing.map(course => course.title + " · " + course.lessonsWithoutGrammar.join(", ")).join("; "));
  const url = "http://127.0.0.1:" + options.port;
  const listening = await portInUse(options.port);
  if (options.check) {
    if (listening) await verifyRuntime(url, library);
    else console.log("Dữ liệu đã kiểm tra; máy chủ local chưa chạy.");
    return library;
  }

  const runtimeDir = path.join(projectDir, ".haneul", "local-runtime");
  const recordFile = path.join(runtimeDir, "server-" + options.port + ".json");
  if (listening) {
    const record = await readJson(recordFile).catch(() => null);
    if (!options.rebuild && record?.projectDir === projectDir && record?.dataDir === dataDir && record?.fingerprint === fingerprint) {
      try { process.kill(record.pid, 0); await verifyRuntime(url, library); console.log("Bản local đúng phiên bản đang chạy: " + url); return library; } catch { /* refuse unidentified listener below */ }
    }
    throw new Error("Cổng " + options.port + " đang có máy chủ khác hoặc bản build cũ. Dừng đúng terminal cũ bằng Ctrl+C, hoặc dùng --port để chọn cổng khác. Không tự dừng tiến trình đó.");
  }
  const nextCli = path.join(projectDir, "node_modules", "next", "dist", "bin", "next");
  if (!await exists(nextCli)) throw new Error("Chạy pnpm install --frozen-lockfile trước khi mở local.");
  const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: "", HANEUL_COURSE_LIBRARY: path.join(dataDir, "courses"), HANEUL_ACTIVE_COURSE_FILE: path.join(dataDir, "active-course.json"), HANEUL_IMPORT_DIR: path.join(dataDir, "import-jobs"), HANEUL_EVENT_DIR: path.join(dataDir, "mcp-events") };
  await mkdir(runtimeDir, { recursive: true });
  const buildFile = path.join(runtimeDir, "build.json");
  const previous = await readJson(buildFile).catch(() => null);
  if (options.rebuild || previous?.fingerprint !== fingerprint || !await exists(path.join(projectDir, ".next", "BUILD_ID"))) {
    console.log("Đang build đúng mã nguồn hiện tại…");
    const result = spawnSync(process.execPath, [nextCli, "build"], { cwd: projectDir, env, stdio: "inherit", windowsHide: true });
    if (result.status !== 0) throw new Error("Build chưa thành công; không khởi chạy một bản build cũ.");
    await writeFile(buildFile, JSON.stringify({ fingerprint: await sourceFingerprint(projectDir), builtAt: new Date().toISOString() }, null, 2));
  }
  console.log("Chế độ học local: giao diện và API cùng " + url + ". Không cần backend riêng hoặc PostgreSQL. Giữ terminal này mở; Ctrl+C để dừng.");
  const child = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(options.port)], { cwd: projectDir, env, stdio: "inherit", windowsHide: true });
  await writeFile(recordFile, JSON.stringify({ pid: child.pid, projectDir, dataDir, fingerprint: await sourceFingerprint(projectDir), startedAt: new Date().toISOString() }, null, 2));
  process.once("SIGINT", () => child.kill("SIGINT"));
  process.once("SIGTERM", () => child.kill("SIGTERM"));
  child.once("error", error => { console.error(error.message); process.exitCode = 1; });
  child.once("exit", code => { process.exitCode = code ?? 0; });
  return library;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runLocal().catch(error => { console.error(error.message); process.exitCode = 1; });
