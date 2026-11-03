import test from "node:test";
import assert from "node:assert/strict";
import { gateway, serveAsset } from "../src/http.ts";
import { allowedEmails } from "../scripts/config.mjs";

const path = `/assets/${"a".repeat(64)}/wop.wasm`;
const request = (suffix = path, init) => new Request(`https://wop.test${suffix}`, init);
const env = { ALLOWED_EMAILS: allowedEmails.join(",") };
const shell = { "/index.html": { body: "PADMAN ✓", contentType: "text/html" } };
const identity = { getIdentity: async () => ({ email: allowedEmails[0] }) };

test("anonymous, forged and unlisted identities cannot reach the shell or cached assets", async () => {
  let calls = 0;
  const exports = { Assets: { fetch: async () => { calls++; return new Response("cached"); } } };
  for (const headers of [{}, { "Cf-Access-Authenticated-User-Email": allowedEmails[0] },
    { "Cf-Access-Jwt-Assertion": "forged" }, { Cookie: "CF_Authorization=forged" }]) {
    for (const url of ["/", path]) {
      const response = await gateway(request(url, { headers }), env, { exports }, shell);
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  }
  const denied = await gateway(request(), env, { exports, access: { getIdentity: async () => ({ email: "other@test.net" }) } }, shell);
  assert.equal(denied.status, 403);
  for (const PUBLIC_PREVIEW of ["false", "1", "TRUE", ""]) {
    assert.equal((await gateway(request(), { ...env, PUBLIC_PREVIEW }, { exports }, shell)).status, 403);
  }
  assert.equal(calls, 0);
});

test("explicit public preview serves the shell and assets without an Access identity", async () => {
  const publicEnv = { ...env, PUBLIC_PREVIEW: "true" };
  let calls = 0;
  const ctx = {
    access: { getIdentity: async () => { throw new Error("Public requests must not resolve identity"); } },
    exports: { Assets: { fetch: async () => { calls++; return new Response("wasm"); } } },
  };
  const response = await gateway(request("/"), publicEnv, ctx, shell);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "PADMAN ✓");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const asset = await gateway(request(), publicEnv, ctx, shell);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), "wasm");
  assert.equal(calls, 1);
  assert.equal((await gateway(request("/", { method: "POST" }), publicEnv, ctx, shell)).status, 405);
});

test("authorized shell is uncached and allows WebAssembly; HEAD has no body", async () => {
  const ctx = { access: identity, exports: {} };
  const response = await gateway(request("/"), env, ctx, shell);
  assert.equal(await response.text(), "PADMAN ✓");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(Number(response.headers.get("Content-Length")), Buffer.byteLength("PADMAN ✓"));
  assert.match(response.headers.get("Content-Security-Policy"), /'wasm-unsafe-eval'/);
  assert.equal((await gateway(request("/", { method: "HEAD" }), env, ctx, shell)).body, null);
  assert.equal((await gateway(request("/", { method: "POST" }), env, ctx, shell)).status, 405);
  for (const url of ["/unknown", "/toString", `${path}?v=1`, "/assets/bad/wop.wasm"]) {
    assert.equal((await gateway(request(url), env, ctx, shell)).status, 404);
  }
});

test("authorized assets strip credentials before shared caching and return private cache headers", async () => {
  const response = await gateway(request(path, { headers: { Cookie: "secret", Authorization: "secret", "If-None-Match": '"hash"' } }), env, {
    access: identity, exports: { Assets: { fetch: async (incoming) => {
      assert.equal(new URL(incoming.url).hostname, "assets.internal");
      assert.equal(incoming.headers.get("Cookie"), null);
      assert.equal(incoming.headers.get("Authorization"), null);
      assert.equal(incoming.headers.get("If-None-Match"), '"hash"');
      return new Response("wasm", { headers: { "Cf-Cache-Status": "HIT" } });
    } } },
  }, shell);
  assert.equal(await response.text(), "wasm");
  assert.equal(response.headers.get("X-Wop-Asset-Cache"), "HIT");
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=31536000, immutable");
});

test("R2 streams GET, omits HEAD bodies, revalidates ETags and fails closed on storage errors", async () => {
  const metadata = { size: 3, httpEtag: '"hash"', writeHttpMetadata: (h) => h.set("Content-Type", "application/wasm") };
  const bucket = { head: async () => metadata, get: async () => ({ ...metadata, body: new Response(new Uint8Array([1, 2, 3])).body }) };
  const response = await serveAsset(request(), bucket);
  assert.equal(response.headers.get("Content-Type"), "application/wasm");
  assert.equal(response.headers.get("Content-Length"), "3");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  assert.equal((await serveAsset(request(path, { method: "HEAD" }), bucket)).body, null);
  const unchanged = await serveAsset(request(path, { headers: { "If-None-Match": '"hash"' } }), bucket);
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, null);
  assert.equal(unchanged.headers.get("Content-Length"), null);
  assert.equal((await serveAsset(request(), { get: async () => null })).status, 404);
  assert.equal((await serveAsset(request(), { get: async () => { throw new Error("offline"); } })).status, 502);
});
