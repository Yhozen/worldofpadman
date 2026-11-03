import { WorkerEntrypoint } from "cloudflare:workers";
import { gateway, serveAsset, type GatewayContext } from "./http.ts";
import { shell } from "../.build/shell.ts";

interface Env { BUCKET: R2Bucket; ALLOWED_EMAILS: string; PUBLIC_PREVIEW?: string }

// Internal entrypoint: reached through the default entrypoint's access mode.
export class Assets extends WorkerEntrypoint<Env> {
  fetch(request: Request) { return serveAsset(request, this.env.BUCKET); }
}

export default {
  fetch(request: Request, env: Env, ctx: GatewayContext) {
    return gateway(request, env, ctx, shell);
  },
};
