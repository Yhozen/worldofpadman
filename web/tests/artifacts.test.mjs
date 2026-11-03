import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageRelease, uploadAssets } from "../scripts/artifacts.mjs";

test("release packages engine and per-map paks with deterministic content hashes and matching shell", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "wop-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "dist"));
  for (const filename of ["wop.js", "wop.wasm", "wop_vm.pk3", "wop_map-test.pk3"]) await writeFile(join(root, "dist", filename), filename);
  await writeFile(join(root, "dist/paks.json"), JSON.stringify({ base: ["wop_vm.pk3"], maps: { test: "wop_map-test.pk3" } }));
  for (const filename of ["index.html", "loader.js"]) await writeFile(join(root, filename), filename);
  const initial = await packageRelease(root);
  assert.deepEqual(await packageRelease(root), initial);
  assert.equal(initial.assets["wop.wasm"].contentType, "application/wasm");
  const code = await readFile(join(root, ".build/shell.ts"));
  const { shell } = await import(`data:text/javascript;base64,${code.toString("base64")}`);
  assert.deepEqual(JSON.parse(shell["/release.json"].body), initial);
  const { files } = JSON.parse(await readFile(join(root, ".build/upload.json")));
  for (const file of files) assert.equal(`/${file.key}`, initial.assets[file.key.split("/").at(-1)].url);
  // Upload must detect local corruption before making any Cloudflare request.
  await writeFile(files[0].path, "corrupt");
  await assert.rejects(uploadAssets(() => { throw new Error("must not call API"); }, "bucket", files), /artifact changed/);
  await writeFile(join(root, "dist/wop.wasm"), "updated wasm");
  assert.notEqual((await packageRelease(root)).id, initial.id);
  await writeFile(join(root, "dist/paks.json"), JSON.stringify({ base: ["../private.pk3"], maps: {} }));
  await assert.rejects(packageRelease(root), /Invalid pak filename/);
});
