export const YEAR = 31536000;
export const assetPath = /^\/assets\/[a-f0-9]{64}\/[a-zA-Z0-9_.-]+\.(?:js|wasm|pk3)$/;
export type Shell = Readonly<Record<string, { readonly body: string; readonly contentType: string }>>;
export interface GatewayContext {
  access?: { getIdentity(): Promise<{ email?: string } | undefined> };
  exports: { Assets: { fetch(request: Request): Promise<Response> } };
}

export function failure(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "no-store" } });
}

export async function serveAsset(request: Request, bucket: R2Bucket): Promise<Response> {
  const url = new URL(request.url);
  if (!assetPath.test(url.pathname) || url.search) return failure("Not found", 404);
  if (request.method !== "GET" && request.method !== "HEAD") return failure("Method not allowed", 405);
  try {
    const key = url.pathname.slice(1);
    const object = request.method === "HEAD" ? await bucket.head(key) : await bucket.get(key);
    if (!object) return failure("Not found", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Content-Length", String(object.size));
    headers.set("Cache-Control", `public, max-age=${YEAR}, immutable`);
    headers.set("X-Content-Type-Options", "nosniff");
    const body = "body" in object ? (object as R2ObjectBody).body : null;
    if (request.headers.get("If-None-Match")?.split(",").map((v) => v.trim()).includes(object.httpEtag)) {
      await body?.cancel();
      headers.delete("Content-Length");
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, { headers });
  } catch { return failure("Asset storage unavailable", 502); }
}

export const shellHeaders = {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export async function gateway(request: Request, env: { ALLOWED_EMAILS: string; PUBLIC_PREVIEW?: string }, ctx: GatewayContext, shell: Shell): Promise<Response> {
  if (env.PUBLIC_PREVIEW !== "true") {
    try {
      const identity = await ctx.access?.getIdentity();
      const allowed = env.ALLOWED_EMAILS.split(",").map((email) => email.trim().toLowerCase());
      if (!identity?.email || !allowed.includes(identity.email.trim().toLowerCase())) return failure("Access required", 403);
    } catch { return failure("Could not verify access", 503); }
  }
  if (request.method !== "GET" && request.method !== "HEAD") return failure("Method not allowed", 405);
  const url = new URL(request.url);
  try {
    if (assetPath.test(url.pathname) && !url.search) {
      const headers = new Headers();
      const etag = request.headers.get("If-None-Match");
      if (etag) headers.set("If-None-Match", etag);
      // Shared cache keys contain content identity only. No user cookies cross this boundary.
      const response = await ctx.exports.Assets.fetch(new Request(`https://assets.internal${url.pathname}`, { method: request.method, headers }));
      const outgoing = new Headers(response.headers);
      outgoing.set("X-Wop-Asset-Cache", response.headers.get("Cf-Cache-Status") ?? "UNKNOWN");
      outgoing.set("Cache-Control", response.ok || response.status === 304 ? `private, max-age=${YEAR}, immutable` : "no-store");
      return new Response(response.body, { status: response.status, headers: outgoing });
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const page = Object.hasOwn(shell, path) ? shell[path] : undefined;
    if (!page || url.search) return failure("Not found", 404);
    return new Response(request.method === "HEAD" ? null : page.body, { headers: {
      ...shellHeaders, "Content-Type": `${page.contentType}; charset=utf-8`,
      "Content-Length": String(new TextEncoder().encode(page.body).byteLength),
    } });
  } catch { return failure("Content unavailable", 502); }
}
