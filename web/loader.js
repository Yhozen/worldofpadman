const canvas = document.querySelector("#canvas");
const status = document.querySelector("#status");
const progress = document.querySelector("#progress");
const play = document.querySelector("#play");
const fullscreen = document.querySelector("#fullscreen");
const log = document.querySelector("#log");
const loaded = new Set(), pending = new Map();
let release;

function print(message) {
  log.textContent = (log.textContent + message + "\n").slice(-24000);
  log.scrollTop = log.scrollHeight;
}
function failure(error) {
  console.error(error);
  print(String(error));
  status.textContent = `Could not load the game: ${error.message ?? error}. Reload to try again.`;
  progress.hidden = true;
}
async function asset(filename) {
  const entry = release.assets[filename];
  if (!entry || !new RegExp(`^/assets/[a-f0-9]{64}/[a-zA-Z0-9_.-]+$`).test(entry.url)) throw new Error(`Missing asset: ${filename}`);
  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("");
  if (bytes.length !== entry.size || hash !== entry.sha256) throw new Error(`Incomplete or corrupt download: ${filename}`);
  return bytes;
}
async function loadPak(filename) {
  if (loaded.has(filename)) return false;
  if (pending.has(filename)) { await pending.get(filename); return false; }
  const promise = (async () => {
    status.textContent = filename.startsWith("wop_map-") ? "Loading map…" : "Loading game files…";
    const bytes = await asset(filename);
    Module.FS.writeFile(`/game/wop/${filename}`, bytes);
    loaded.add(filename);
  })();
  pending.set(filename, promise);
  try { await promise; return true; } finally { pending.delete(filename); }
}
async function loadMap(map) {
  const filename = release.maps[map];
  if (!filename) throw new Error(`Map is not in this build: ${map}`);
  const changed = await loadPak(filename);
  status.textContent = "Click the game to play · Esc for the menu";
  return changed;
}

const Module = window.Module = {
  canvas, print, printErr: print,
  arguments: ["+set", "fs_basepath", "/game", "+set", "fs_homepath", "/home/web",
    "+set", "sv_pure", "0", "+set", "vm_game", "2", "+set", "vm_cgame", "2", "+set", "vm_ui", "2",
    "+set", "r_mode", "-1", "+set", "r_customwidth", "1280", "+set", "r_customheight", "720",
    "+set", "r_fullscreen", "0", "+set", "ttycon", "0", "+set", "com_hunkMegs", "256"],
  locateFile: (filename) => filename.endsWith(".wasm") ? release.assets["wop.wasm"].url : filename,
  onAbort: failure,
  onRuntimeInitialized() {
    status.textContent = "Click the game to play · Esc for the menu";
    progress.hidden = true;
    fullscreen.hidden = false;
    canvas.focus();
  },
  // Suspend startup while the filesystem and initial packages are prepared.
  preRun: [() => {
    Module.addRunDependency("game-files");
    (async () => {
      Module.FS.mkdirTree("/game/wop");
      Module.FS.mkdirTree("/home/web");
      Module.FS.mount(Module.IDBFS, {}, "/home/web");
      await new Promise((resolve, reject) => Module.FS.syncfs(true, (error) => error ? reject(error) : resolve()));
      const base = release.base.filter((name) => name !== "wop_music.pk3" && name !== "wop_video.pk3");
      for (let i = 0; i < base.length; i++) {
        await loadPak(base[i]);
        progress.value = (i + 1) / base.length;
      }
      Module.removeRunDependency("game-files");
    })().catch(failure);
  }],
  wopFetchMapPak(map, _gametype, haveMap) {
    // All team skins ship in the base packages. Already loaded maps must answer synchronously.
    if (haveMap) { Module.ccall("CL_WebPakReady", null, ["number"], [0]); return; }
    loadMap(map).then((changed) => Module.ccall("CL_WebPakReady", null, ["number"], [Number(changed)]))
      .catch((error) => { failure(error); Module.ccall("CL_WebPakReady", null, ["number"], [0]); });
  },
  wopFetchServerMap(map, command) {
    // Cmd_Cmd() passes the complete original command, including its map argument.
    const verb = command.trim().split(/\s+/, 1)[0];
    if (!/^[a-zA-Z0-9_-]+$/.test(map) || !/^(?:devmap|map|spmap|spdevmap)$/.test(verb)) return;
    loadMap(map).then(() => {
      Module.ccall("FS_WebRescan", null, [], []);
      Module.ccall("Cbuf_AddText", null, ["string"], [`${verb} ${map}\n`]);
    }).catch(failure);
  },
};

play.addEventListener("click", async () => {
  play.disabled = true;
  progress.hidden = false;
  try {
    if (!document.createElement("canvas").getContext("webgl2")) throw new Error("WebGL 2 is unavailable in this browser");
    const response = await fetch("/release.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Release manifest: HTTP ${response.status}`);
    release = await response.json();
    const engine = release.assets["wop.js"];
    const script = document.createElement("script");
    script.src = engine.url;
    const digest = engine.sha256.match(/../g).map((pair) => String.fromCharCode(parseInt(pair, 16))).join("");
    script.integrity = `sha256-${btoa(digest)}`;
    script.crossOrigin = "anonymous";
    script.onerror = () => failure(new Error("The engine could not be downloaded"));
    document.body.append(script);
  } catch (error) { failure(error); }
});
canvas.addEventListener("click", () => { canvas.focus(); if (Module.calledRun) canvas.requestPointerLock(); });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
fullscreen.addEventListener("click", () => canvas.requestFullscreen());
window.addEventListener("pagehide", () => { if (Module.calledRun) Module.ccall("CL_WebDisconnect", null, [], []); });
// Persist the engine's archived configuration during play; pagehide cannot await an IndexedDB write.
let syncing = false;
setInterval(() => {
  if (!Module.calledRun || syncing) return;
  syncing = true;
  Module.FS.syncfs(false, (error) => { syncing = false; if (error) print(`Could not save settings: ${error}`); });
}, 10000);
