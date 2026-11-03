import { fileURLToPath } from "node:url";
import { packageRelease } from "./artifacts.mjs";
console.log(`Packaged release ${(await packageRelease(fileURLToPath(new URL("..", import.meta.url)))).id}`);
