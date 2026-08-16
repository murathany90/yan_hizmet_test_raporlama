import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
function run(program, args, cwd = root) {
  const result = spawnSync(program, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Tauri CLI, build modunda frontendDist'i ikiliye gömen gerekli ortam
// değişkenlerini ayarlar. Cargo'yu doğrudan çağırmak devUrl'e (127.0.0.1)
// düşen, taşınabilir olmayan bir uygulama üretebilir.
if (process.platform === "win32") run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm.cmd run tauri -- build --no-bundle"]);
else run("npm", ["run", "tauri", "--", "build", "--no-bundle"]);

const executable = resolve(root, "src-tauri", "target", "release", "teias-yhda.exe");
if (!existsSync(executable)) throw new Error(`Taşınabilir uygulama bulunamadı: ${executable}`);

const now = new Date();
const pad = (value) => String(value).padStart(2, "0");
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const outputDirectory = resolve(root, "dist");
const output = resolve(outputDirectory, `TEIAS-YHDA_v${packageJson.version}_portable_${stamp}.exe`);
mkdirSync(outputDirectory, { recursive: true });
copyFileSync(executable, output);
console.log(`Portable EXE: ${output}`);
