// Run against `pnpm serve`: CHROME_PATH=/path/to/chrome node scripts/smoke.mjs [URL]
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
const monitor = setInterval(async () => {
  console.log(await page.locator("#status").textContent().catch(() => "page unavailable"));
  console.log((await page.locator("#log").textContent().catch(() => "")).slice(-1500));
}, 15000);
try {
  page.on("pageerror", (error) => { errors.push(String(error)); console.error(`Browser: ${error}`); });
  page.on("console", (message) => { if (message.type() === "error") console.error(message.text()); });
  await page.goto(process.argv[2] ?? "http://127.0.0.1:8440");
  await page.click("#play");
  await page.waitForFunction(() => document.querySelector("#log").textContent.includes("Client Initialization Complete"), null, { timeout: 180000 });
  console.log("Browser menu initialized");
  await page.evaluate(() => Module.ccall("Cbuf_AddText", null, ["string"], ["devmap wop_padgarden\n"]));
  await page.waitForFunction(() => document.querySelector("#log").textContent.includes("CL_InitCGame"), null, { timeout: 120000 });
  console.log("On-demand map started");
  // Repeat the map through the already-loaded path, exercising synchronous CL_WebPakReady.
  await page.evaluate(() => {
    document.querySelector("#log").textContent = "";
    Module.ccall("Cbuf_AddText", null, ["string"], ["devmap wop_padgarden\n"]);
  });
  await page.waitForFunction(() => document.querySelector("#log").textContent.includes("CL_InitCGame"), null, { timeout: 120000 });
  console.log("Already-loaded map restarted");
  await page.waitForTimeout(3000);
  const screenshot = process.env.SCREENSHOT;
  if (screenshot) await page.screenshot({ path: screenshot });
  console.log((await page.locator("#log").textContent()).slice(-5000));
  assert.deepEqual(errors, [], "JavaScript runtime errors");
} catch (error) {
  console.error(await page.locator("#status").textContent().catch(() => "page unavailable"));
  console.error(await page.locator("#log").textContent().catch(() => "log unavailable"));
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT }).catch(() => {});
  throw error;
} finally {
  clearInterval(monitor);
  await browser.close();
}
