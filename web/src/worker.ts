import { WorkerEntrypoint } from "cloudflare:workers";
import { gateway, serveAsset, type GatewayContext } from "./http.ts";
import { shell } from "../.build/shell.ts";

interface Env { BUCKET: R2Bucket; ALLOWED_EMAILS: string }

// Internal entrypoint: only called after authorization in the default entrypoint.
export class Assets extends WorkerEntrypoint<Env> {
  fetch(request: Request) { return serveAsset(request, this.env.BUCKET); }
}

export default {
  fetch(request: Request, env: Env, ctx: GatewayContext) {
    return gateway(request, env, ctx, shell);
  },
};
