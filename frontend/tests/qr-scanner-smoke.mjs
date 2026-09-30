import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Run camera tests against a local TEST installation, not a public restaurant.");
const password = process.env.TEST_STAFF_PASSWORD;
if (!password) throw new Error("Set TEST_STAFF_PASSWORD to a local manager account password.");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: process.env.CHROMIUM_EXECUTABLE ? ["--no-sandbox", "--disable-dev-shm-usage"] : [],
});
const checks = [], errors = [];
const suffix = randomUUID().slice(0, 8);
const restaurantName = `Camera review ${suffix}`;
const tableName = "Table 1";

async function staffApi(page, path, method = "GET", body) {
  return page.evaluate(async ({ path, method, body }) => {
    const token = JSON.parse(sessionStorage.getItem("staff") ?? "null")?.accessToken;
    const response = await fetch("/api" + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID() },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, body });
}

try {
  const manager = await browser.newPage();
  manager.on("pageerror", (e) => errors.push(e.message));
  await manager.goto(base + "/manage");
  await manager.getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test");
  await manager.getByLabel("Password", { exact: true }).fill(password);
  await manager.getByRole("button", { name: "Sign in", exact: true }).click();
  await manager.getByRole("heading", { name: "Restaurant overview" }).waitFor();
  const created = await staffApi(manager, "/restaurants", "POST", { name: restaurantName });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const rid = created.body.id;
  const starter = await staffApi(manager, `/restaurants/${rid}/starter`, "POST", {
    branchName: "Main", tableLabel: tableName, categoryName: "Food",
    productName: "Practice dish", priceBani: 2500,
  });
  assert.equal(starter.status, 200, JSON.stringify(starter.body));
  const tid = starter.body.tableId;
  const opened = await staffApi(manager, `/restaurants/${rid}/tables/${tid}/sessions`, "POST");
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  const link = await staffApi(manager, `/restaurants/${rid}/tables/${tid}/link`);
  assert.equal(link.status, 200, JSON.stringify(link.body));
  const printed = `${new URL(base).origin}/?join=${link.body.token}`;
  checks.push("Manager creates a fictional restaurant, an open table and a signed printed QR link");

  const guest = await browser.newPage({ viewport: { width: 320, height: 780 } });
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.addInitScript(() => {
    window.__nextTableCode = "";
    window.__tracksStopped = 0;
    window.BarcodeDetector = class {
      async detect() {
        if (!window.__nextTableCode) return [];
        const rawValue = window.__nextTableCode;
        window.__nextTableCode = "";
        return [{ rawValue }];
      }
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => {
        const canvas = document.createElement("canvas");
        const source = canvas.captureStream(10);
        for (const track of source.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { window.__tracksStopped++; stop(); };
        }
        return source;
      } },
    });
    HTMLMediaElement.prototype.play = async () => {};
  });
  await guest.goto(base + "/guest");
  const scan = guest.getByRole("button", { name: "Scan table QR" });
  await scan.click();
  await guest.getByRole("status").filter({ hasText: "Point the camera" }).waitFor();
  await guest.evaluate(() => { window.__nextTableCode = "https://outside.example/?join=invalid"; });
  await guest.getByRole("status").filter({ hasText: "not a table QR" }).waitFor();
  assert.equal(await guest.evaluate(() => sessionStorage.getItem("guest")), null);
  await guest.evaluate((value) => { window.__nextTableCode = value; }, printed);
  const confirmation = guest.getByRole("dialog", { name: "QR scanned successfully" });
  await confirmation.waitFor();
  await confirmation.getByText(restaurantName, { exact: false }).waitFor();
  await confirmation.getByText(tableName, { exact: true }).waitFor();
  assert.equal(await guest.evaluate(() => sessionStorage.getItem("guest")), null,
    "Preview must not join or create a guest identity");
  assert.equal(await guest.evaluate(() => window.__tracksStopped), 1,
    "The video track must stop when a code is detected");
  await confirmation.getByRole("button", { name: `Continue to ${tableName}` }).click();
  const nickname = guest.getByLabel("Your nickname");
  assert(await nickname.evaluate((element) => document.activeElement === element),
    "Closing the scan confirmation must focus the join form");
  checks.push("Camera stops after detection, shows a required table confirmation and moves focus to joining");

  await nickname.fill("Practice guest");
  await guest.getByRole("button", { name: "Join table", exact: true }).click();
  await guest.getByRole("status").filter({ hasText: `Joined ${tableName}` }).waitFor();
  await guest.getByRole("heading", { name: "Something for everyone" }).waitFor();
  assert.equal(await guest.evaluate(() => JSON.parse(sessionStorage.getItem("guest")).sessionId),
    opened.body.sessionId);
  checks.push("An anonymous guest joins only after confirming the name and table");

  const fallback = await browser.newPage();
  fallback.on("pageerror", (e) => errors.push(e.message));
  await fallback.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", { configurable: true, value: undefined });
  });
  await fallback.goto(base + "/guest");
  await fallback.getByRole("button", { name: "Scan table QR" }).click();
  await fallback.getByRole("status").filter({ hasText: "cannot read QR codes" }).waitFor();
  await fallback.getByLabel("Paste table link or code").fill(printed);
  await fallback.getByRole("button", { name: "Preview table" }).click();
  await fallback.getByText(restaurantName, { exact: false }).waitFor();
  assert.equal(await fallback.evaluate(() => sessionStorage.getItem("guest")), null);
  checks.push("Unsupported camera decoder still offers a working paste-link preview without signing in");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} finally {
  await browser.close();
}
