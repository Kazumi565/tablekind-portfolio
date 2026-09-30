import { section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const custom = process.env.CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({
  headless: true,
  executablePath: custom || undefined,
  args: custom
    ? [
        "--no-sandbox",
        "--no-zygote",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ]
    : [],
});
const errors = [],
  checks = [];
const output = "test-results/phase7";
mkdirSync(output, { recursive: true });
async function page(width = 390) {
  const p = await browser.newPage({ viewport: { width, height: 844 } });
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function fits(p) {
  assert.equal(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    "No horizontal page overflow",
  );
}
async function login(p, email, password, code) {
  await p.goto(base);
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Password", { exact: true }).fill(password);
  if (code) {
    await p.getByText("Using two-step sign-in?", { exact: true }).click();
    await p.getByLabel("Authenticator or recovery code").fill(code);
  }
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function api(p, path, body, method = "POST") {
  return p.evaluate(
    async ({ path, body, method }) => {
      const token = JSON.parse(sessionStorage.getItem("staff")).accessToken;
      const r = await fetch("/api" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      return data;
    },
    { path, body, method },
  );
}
function otp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    value = 0;
  const bytes = [];
  for (const c of secret) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const n = h[h.length - 1] & 15;
  return String((h.readUInt32BE(n) & 0x7fffffff) % 1000000).padStart(6, "0");
}
try {
  const manager = await page(1280);
  await login(
    manager,
    process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test",
    process.env.TEST_STAFF_PASSWORD ?? "Local-Review-2026!",
  );
  await manager
    .getByRole("button", { name: "Restaurant setup", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "New restaurant", exact: true })
    .click();
  const name = "Phase 7 " + Date.now();
  await manager.getByLabel("Restaurant name", { exact: true }).fill(name);
  await manager
    .getByRole("button", { name: "Create restaurant", exact: true })
    .click();
  await manager.getByRole("heading", { name, exact: true }).waitFor();
  const rid = await manager
    .getByLabel("Restaurant", { exact: true })
    .inputValue();
  const prefix = "/restaurants/" + rid;
  await manager
    .getByRole("button", { name: "branches & tables", exact: true })
    .click();
  await manager.getByLabel("Branch name", { exact: true }).fill("Central");
  await manager
    .getByRole("button", { name: "Add branch", exact: true })
    .click();
  await manager.getByLabel("New table label").fill("Table 7");
  await manager.getByRole("button", { name: "Add table", exact: true }).click();
  await manager.getByLabel("Table label", { exact: true }).waitFor();
  await manager.getByLabel("Service mode").selectOption("PAY_AT_TABLE");
  await manager.getByLabel("Default menu language").selectOption("ro");
  await manager
    .getByRole("button", { name: "Save service settings", exact: true })
    .click();
  await manager.getByText("Service settings saved.", { exact: true }).waitFor();
  checks.push(
    "Restaurant, branch, pilot table, service mode and language configured through forms",
  );
  await manager.getByRole("button", { name: "menu", exact: true }).click();
  await manager
    .getByRole("button", { name: "Add category", exact: true })
    .click();
  await manager.getByLabel("Category name (en)").fill("Food");
  await manager
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await manager.getByLabel("Name (en)", { exact: true }).fill("Soup");
  await manager.getByLabel("Name (ro)", { exact: true }).fill("Supă");
  await manager.getByLabel("Price in MDL").fill("45");
  await manager
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await manager.getByRole("dialog").waitFor({ state: "hidden" });
  await manager.getByRole("button", { name: "staff", exact: true }).click();
  const email = "waiter-" + Date.now() + "@example.test",
    password = "Browser-Staff-Password!";
  await manager.getByLabel("Name", { exact: true }).fill("Waiter");
  await manager.getByLabel("Email", { exact: true }).fill(email);
  await manager.getByLabel("Initial password (12+ characters)").fill(password);
  await manager
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await manager.getByText(email + " · waiter", { exact: true }).waitFor();
  await manager.getByRole("button", { name: "QR codes", exact: true }).click();
  await manager
    .getByRole("button", { name: "Create printed code", exact: true })
    .click();
  await manager
    .getByRole("link", { name: "Try guest link", exact: true })
    .waitFor();
  const url = await manager
    .getByRole("link", { name: "Try guest link", exact: true })
    .getAttribute("href");
  await manager.emulateMedia({ media: "print" });
  assert.equal(await manager.locator(".print-only-card img").isVisible(), true);
  assert.equal(
    await manager
      .getByRole("button", { name: "My account", exact: true })
      .isVisible(),
    false,
  );
  await manager.pdf({ path: output + "/printed-qr.pdf", format: "A4" });
  await manager.emulateMedia({ media: "screen" });
  await manager.setViewportSize({ width: 390, height: 844 });
  await fits(manager);
  await manager.screenshot({
    path: output + "/phone-printed-qr.png",
    fullPage: true,
  });
  const guest = await page();
  await guest.goto(url);
  await guest
    .getByText("Ask the waiter to open this table before joining.", {
      exact: true,
    })
    .waitFor();
  await section(manager, "Our table");
  await manager.getByRole("button", { name: /Table 7.*Open table/ }).click();
  await manager.getByRole("dialog").waitFor();
  await manager
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await guest.reload();
  await guest.getByLabel("Your nickname").fill("Ana");
  await guest.getByRole("button", { name: "Join table", exact: true }).click();
  await guest
    .getByRole("heading", { name: "Order with your waiter", exact: true })
    .waitFor();
  assert.equal(await guest.getByLabel("Menu language").inputValue(), "ro");
  assert.equal(
    await guest
      .getByRole("button", { name: "Restaurant setup", exact: true })
      .count(),
    0,
  );
  checks.push(
    "Printed QR rejects a closed table, confirms an active table and respects pay-at-table mode",
  );
  const dash = await api(manager, prefix, undefined, "GET");
  const sid = dash.tables[0].session_id;
  const state = await api(manager, "/sessions/" + sid, undefined, "GET");
  const gid = state.guests[0].id;
  await section(manager, "Menu");
  await manager.getByRole("button", { name: "Order", exact: true }).click();
  await manager.getByLabel("Guest placing the order").selectOption(gid);
  await manager
    .getByRole("button", { name: "Submit order · 45.00 MDL", exact: true })
    .click();
  await section(manager, "Our table");
  await manager
    .getByRole("button", { name: "Accept order", exact: true })
    .click();
  await section(guest, "My order");
  await guest.getByRole("heading", { name: "1 × Supă", exact: true }).waitFor();
  await guest
    .getByRole("button", { name: "Pay & split", exact: true })
    .first()
    .click();
  await guest.getByText("My unpaid share", { exact: true }).waitFor();
  await guest
    .locator(".personal-bill")
    .getByRole("heading", { name: "45.00 MDL", exact: true })
    .waitFor();
  assert.equal(
    await guest.getByLabel("Custom amount in MDL (optional)").isVisible(),
    false,
  );
  await fits(guest);
  await guest.screenshot({
    path: output + "/phone-personal-bill.png",
    fullPage: true,
  });
  checks.push(
    "Staff can enter orders in pay-at-table mode; guest sees their personal bill with advanced checkout collapsed",
  );
  const waiter = await page();
  await login(waiter, email, password);
  await waiter
    .getByRole("button", { name: "Availability", exact: true })
    .waitFor();
  assert.equal(
    await waiter
      .getByRole("button", { name: "POS integration", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await waiter
      .getByRole("button", { name: "Restaurant setup", exact: true })
      .count(),
    0,
  );
  await section(waiter, "My account");
  await waiter.getByLabel("Current password", { exact: true }).fill(password);
  await waiter
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const seed = (await waiter.locator(".secret-text").innerText()).replace(
    "Manual key: ",
    "",
  );
  await waiter.getByLabel("Authenticator or recovery code").fill(otp(seed));
  await waiter
    .getByRole("button", { name: "Enable two-step sign-in", exact: true })
    .click();
  await waiter
    .getByRole("heading", { name: "Save your recovery codes now", exact: true })
    .waitFor();
  const recovery = (
    await waiter.locator(".security-panel pre, section.card pre").innerText()
  )
    .trim()
    .split("\n")[0];
  await waiter
    .getByRole("button", { name: "I saved them — sign in again", exact: true })
    .click();
  await login(waiter, email, password);
  await waiter
    .getByRole("alert")
    .filter({ hasText: "authenticator" })
    .waitFor();
  assert.equal(
    await waiter.getByLabel("Authenticator or recovery code").isVisible(),
    true,
  );
  await waiter.getByLabel("Authenticator or recovery code").fill(recovery);
  await waiter.getByRole("button", { name: "Sign in", exact: true }).click();
  await waiter
    .getByRole("button", { name: "Availability", exact: true })
    .waitFor();
  await fits(waiter);
  checks.push(
    "Waiter UI hides manager tools; authenticator enrollment and recovery sign-in work on a phone",
  );
  await manager
    .getByRole("button", { name: "Restaurant setup", exact: true })
    .click();
  await manager.getByRole("button", { name: "start", exact: true }).click();
  await manager
    .getByRole("heading", {
      name: "Get your restaurant ready to try",
      exact: true,
    })
    .waitFor();
  await fits(manager);
  await manager.screenshot({
    path: output + "/phone-onboarding.png",
    fullPage: true,
  });
  await manager.setViewportSize({ width: 1280, height: 900 });
  await fits(manager);
  await manager.screenshot({
    path: output + "/desktop-onboarding.png",
    fullPage: true,
  });
  const unknown = "limit-" + Date.now() + "@example.test";
  let response;
  // A fixed-window boundary may fall between requests; stop at the first actual limit.
  for (let i = 0; i < 21 && response?.status() !== 429; i++)
    response = await manager.request.post(base + "/api/auth/login", {
      data: { email: unknown, password: "Wrong-password!" },
    });
  assert.equal(response.status(), 429);
  assert.equal(response.headers()["retry-after"], "60");
  checks.push("Login throttling returns HTTP 429 and a retry hint");
  assert.deepEqual(errors, []);
  checks.push("No uncaught browser errors or phone/desktop page overflow");
  const result = { status: "passed", checks };
  writeFileSync(output + "/results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Browser errors:", errors);
  for (const c of browser.contexts())
    for (const p of c.pages()) {
      console.error((await p.locator("body").innerText()).slice(-3500));
      await p.screenshot({
        path: output + "/failure-" + browser.contexts().indexOf(c) + ".png",
        fullPage: true,
      });
    }
  throw error;
} finally {
  await browser.close();
}
