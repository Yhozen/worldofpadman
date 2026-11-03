import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { readFile } from "node:fs/promises";
import { api } from "./scripts/cloudflare.ts";
import { allowedEmails, domain, workerName } from "./scripts/config.mjs";
import { uploadAssets } from "./scripts/artifacts.mjs";

interface Upload {
  releaseId: string;
  files: { key: string; path: string; sha256: string; md5: string; size: number; contentType: string }[];
}

const PublishAssets = Alchemy.Action("PublishAssets", Effect.gen(function* () {
  const credentials = yield* Cloudflare.CloudflareEnvironment.current;
  return (input: Upload & { bucket: string }) => Effect.tryPromise(async () => {
    await uploadAssets(api(credentials), input.bucket, input.files);
    return { releaseId: input.releaseId };
  });
}));

export default Alchemy.Stack("WopWeb", {
  providers: Cloudflare.providers(), state: Cloudflare.state(),
}, Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  if (stage !== "preview") return yield* Effect.die(new Error("Deploy this stack with --stage preview"));
  const publicPreview = process.env.WOP_PUBLIC_PREVIEW === "1";
  const upload = yield* Effect.tryPromise(async () => JSON.parse(
    await readFile(new URL("./.build/upload.json", import.meta.url), "utf8")) as Upload).pipe(Effect.orDie);
  const bucket = yield* Cloudflare.R2.Bucket("Assets", { publicAccess: false });
  // Horizon owns the account's shared email login. Lookup avoids adopting or deleting it.
  const login = Cloudflare.Access.getIdentityProvider({ type: "onetimepin" });
  const published = yield* PublishAssets({ ...upload, bucket: bucket.bucketName });
  const game = yield* Cloudflare.Worker("Game", {
    name: workerName,
    domain,
    main: "./src/worker.ts",
    compatibility: { date: "2026-10-24" },
    workersDev: { enabled: true, previewsEnabled: false },
    access: {
      name: "World of PADMAN private preview",
      allowedIdps: [login.identityProviderId.as<string>()], autoRedirectToIdentity: true,
      sessionDuration: "24h", policies: publicPreview
        ? [{ decision: "bypass", include: ["everyone"] }]
        : [{ decision: "allow", include: allowedEmails.map((email) => ({ email })) }],
    },
    cache: { enabled: true, crossVersionCache: true },
    entrypoints: { default: { cache: { enabled: false } }, Assets: { cache: { enabled: true } } },
    env: { BUCKET: bucket, ALLOWED_EMAILS: allowedEmails.join(","),
      PUBLIC_PREVIEW: String(publicPreview), RELEASE_ID: published.releaseId },
    observability: { enabled: true },
  });
  return { url: game.url, bucketName: bucket.bucketName, releaseId: published.releaseId };
}));
