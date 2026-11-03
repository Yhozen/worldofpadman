// Local static smoke testing. Production requests are authorized by the Cloudflare Worker.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const build = fileURLToPath(new URL("../.build/", import.meta.url));
const upload = JSON.parse(await readFile(join(build, "upload.json"), "utf8"));
const routes = new Map(upload.files.map((file) => [`/${file.key}`, file]));
for (const [name, contentType] of [["index.html", "text/html"], ["loader.js", "text/javascript"], ["release.json", "application/json"]]) {
  routes.set(`/${name}`, { path: join(build, "site", name), contentType });
}
routes.set("/", routes.get("/index.html"));
const server = createServer(async (request, response) => {
  const file = routes.get(request.url);
  if (!file || !["GET", "HEAD"].includes(request.method)) { response.writeHead(404).end(); return; }
  try {
    const info = await stat(file.path);
    response.writeHead(200, { "Content-Type": file.contentType, "Content-Length": info.size, "Cache-Control": "no-store" });
    if (request.method === "HEAD") response.end();
    else createReadStream(file.path).pipe(response);
  } catch { response.writeHead(500).end(); }
});
server.listen(Number(process.env.PORT ?? 8440), "127.0.0.1", () => console.log(`World of PADMAN: http://127.0.0.1:${server.address().port}`));
