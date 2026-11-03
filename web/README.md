# World of PADMAN browser preview

Private preview at **https://wop.rccpr.tech**, following `portal-web/web` and `horizon/web`:

- Alchemy v2 stack `WopWeb`, stage `preview`, Worker `wop-web-preview`.
- Cloudflare Access email codes, 24-hour sessions, and the same three email addresses in
  `scripts/config.mjs`. The Worker checks the platform's Access identity before serving any route,
  including cache hits. It looks up Horizon's existing email provider rather than owning it.
- A new private R2 bucket holds content-addressed WebAssembly, JavaScript and game PK3s. Uploads
  check SHA-256/MD5 and existing objects before publishing the Worker. Old objects remain for rollback.
- The small HTML/loader/manifest shell is embedded in the Worker, since Static Assets does not
  forward `ctx.access`. Shell responses use `no-store`. Assets pass through a separate internal
  cache entrypoint after authorization, and return `private, max-age=31536000, immutable` to browsers.

## Build and play locally

Prerequisites: Node 24+, pnpm 10.33.0, Python 3, CMake 3.24+, a native C/C++ compiler, Git LFS,
and [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) **4.0.10** activated
in the current shell (`source /path/to/emsdk/emsdk_env.sh`).

```sh
git lfs pull
cd web
pnpm install --frozen-lockfile
pnpm build
pnpm check && pnpm test
pnpm serve
# Open http://127.0.0.1:8440, then click Play.
```

`pnpm build` compiles QVM game logic with native host tools, builds the engine with Emscripten,
and creates deterministic PK3s from this checkout's game assets. Missing LFS content fails the build.
No prebuilt engine or external game install is needed. Set `CMAKE` or `PYTHON` to override their
executables. Generated files live in `dist/`, `.build/`, and the engine's existing ignored output paths.
`pnpm package` repackages an existing `dist/` without rebuilding the C engine.

Click **Play** to download the base game and open its menu. Individual maps download on demand,
including maps selected through the in-game menu. Team skins are included in the base packages.
Music and video PK3s are packaged but omitted from the initial download. Settings persist in IndexedDB.
This source revision downloads about 654 MiB initially; the complete R2 release is about 1.14 GiB
and includes 65 maps. Browser caching avoids repeating unchanged downloads.
Use a desktop browser with WebGL 2, keyboard and mouse. This deployment supports local play with bots;
connecting to native UDP multiplayer servers requires a separate WebSocket-to-UDP relay.

The static local server binds to loopback, uses the production CSP, and does not simulate Access. HTTP tests cover the real
Worker gateway, forged identities, authorization before cache lookup, headers, ETags, and storage
failures. Artifact tests cover deterministic releases, invalid filenames, and upload integrity checks.
The GitHub `Web preview` workflow builds from source and runs these checks on pull requests.
With the local server running, `CHROME_PATH=/path/to/chrome pnpm test:browser` also starts the real
engine, loads a map, and restarts it through the already-loaded path in headless Chrome.
It fails immediately on any browser dialog and checks that animation frames keep advancing;
Playwright's automatic dialog dismissal cannot hide a blocked engine. CI also runs this browser check.
The Emscripten client uses the passive console instead of reading the browser's emulated terminal.
Set `SCREENSHOT` to save a screenshot.

## Deploy

Use the same Cloudflare account and Alchemy `default` profile as Portal/Horizon. The token needs
Workers Scripts, Workers Routes/Custom Domains, R2 edit, Access apps/policies, and zone read for
`rccpr.tech`. Clear inherited `CLOUDFLARE_*` variables so they do not shadow the intended profile.
The zone and Horizon's One-time PIN provider must already exist. Alchemy creates the domain's DNS/TLS;
an existing conflicting DNS record must be resolved before attaching the domain.

```sh
cd web
pnpm build
pnpm alchemy plan --stage preview --profile default
pnpm alchemy deploy --stage preview --profile default
# Subsequent updates: pnpm deploy (builds first).
```

Review the plan: a new private bucket, the asset publication action, one Worker, one Access app and
its allow policy, and `wop.rccpr.tech`. No container, UDP port, or changes to the other games are needed.
Only `preview` is accepted. Deploy from the checked-out commit; merging the PR runs validation,
and deployment is explicit as in Portal/Horizon. To roll back, build and deploy an older commit.

After deploy, anonymous requests to both the custom domain and `workers.dev` should redirect to
Access (or receive the Worker's 403). Sign in with an allowlisted email, click Play, start a local map,
and verify another map loads. `X-Wop-Asset-Cache` reports the internal cache status on asset responses.

Game code and artwork retain the licenses in the repository's `COPYING.md`, `GPL-2.0.md`,
`LICENSES.md` and `MAPPACK.md`.
