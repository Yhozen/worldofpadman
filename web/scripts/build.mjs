import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageRelease } from "./artifacts.mjs";

const web = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));
const cmake = process.env.CMAKE ?? "cmake";
function run(command, args) {
  const result = spawnSync(command, args, { cwd: repo, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
const jobs = String(Math.min(availableParallelism(), 8));
// Emscripten's build-time tools are CommonJS, even though this deployment package is ESM.
await mkdir(join(web, ".build/wasm"), { recursive: true });
await writeFile(join(web, ".build/wasm/package.json"), '{"type":"commonjs"}\n');
// QVM compilers spawn subprocesses, so build and run them on the host, not under Emscripten.
run(cmake, ["-S", repo, "-B", join(web, ".build/native"), "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_CLIENT=OFF", "-DBUILD_SERVER=OFF", "-DBUILD_TESTS=OFF", "-DUSE_HTTP=OFF"]);
run(cmake, ["--build", join(web, ".build/native"), "--target", "qvm", "--parallel", jobs]);
run("emcmake", [cmake, "-S", repo, "-B", join(web, ".build/wasm"), "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_SERVER=OFF", "-DBUILD_TESTS=OFF", "-DUSE_HTTP=OFF", "-DUSE_MUMBLE=OFF", "-DUSE_VOIP=OFF",
  "-DUSE_RENDERER_DLOPEN=OFF", "-DUSE_OPENAL_DLOPEN=OFF"]);
run(cmake, ["--build", join(web, ".build/wasm"), "--target", "wop", "--parallel", jobs]);
await mkdir(join(web, "dist"), { recursive: true });
const engine = (await readdir(repo)).find((name) => /^wop\..+\.js$/.test(name));
if (!engine) throw new Error("Emscripten did not produce wop.*.js");
await copyFile(join(repo, engine), join(web, "dist/wop.js"));
await copyFile(join(repo, engine.replace(/\.js$/, ".wasm")), join(web, "dist/wop.wasm"));
run(process.env.PYTHON ?? "python3", [join(web, "scripts/paks.py"), repo, join(web, "dist")]);
const release = await packageRelease(web);
console.log(`Packaged World of PADMAN release ${release.id}`);
