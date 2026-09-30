import { section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const output = resolve("test-results/pos-browser");
mkdirSync(output, { recursive: true });
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
let token;
async function api(path, body, method = "POST", auth = token) {
  const response = await context.request.fetch(base + "/api" + path, {
    method,
    headers: {
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
      "Idempotency-Key": crypto.randomUUID(),
    },
    ...(method === "GET" ? {} : { data: body ?? {} }),
  });
  const result = await response.json();
  assert.equal(response.ok(), true, JSON.stringify(result));
  return result;
}
async function until(check) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await check()) return;
    await page.waitForTimeout(250);
  }
  throw new Error("Timed out waiting for POS condition");
}
try {
  await page.goto(base);
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_STAFF_PASSWORD ?? "Local-Review-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).waitFor();
  token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("staff")).accessToken,
  );
  const restaurant = await api("/restaurants", {
    name: "POS browser " + Date.now(),
  });
  const prefix = "/restaurants/" + restaurant.id;
  const branch = await api(prefix + "/branches", {
    name: "POS branch",
    timezone: "Europe/Chisinau",
    approvalRequired: true,
    acceptingOrders: true,
    hours: [],
  });
  const table = await api(prefix + "/branches/" + branch.id + "/tables", {
    label: "POS table",
    pilotEnabled: true,
    maxGuests: 20,
  });
  const category = await api(prefix + "/categories", {
    names: { en: "Food" },
    sortOrder: 0,
  });
  const product = await api(prefix + "/products", {
    categoryId: category.id,
    names: { en: "POS pizza" },
    descriptions: {},
    allergens: [],
    dietaryLabels: [],
    priceBani: 10001,
    available: true,
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByLabel("Restaurant", { exact: true })
    .selectOption(restaurant.id);
  await section(page, "POS integration");
  await page
    .getByRole("button", { name: "Connect TEST POS", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "TEST POS · Active", exact: true })
    .waitFor();
  checks.push("Manager connects TEST POS without replaying old sessions");

  await section(page, "Our table");
  await page.getByRole("button", { name: "POS table Open table" }).click();
  const qr = page.getByRole("dialog", { name: "Join this table" });
  const url = await qr.getByLabel("Join link", { exact: true }).inputValue();
  const sid = await page.evaluate(() =>
    sessionStorage.getItem("staffSessionId"),
  );
  await qr.getByRole("button", { name: "Close dialog" }).click();
  const guest = await api(
    "/join",
    { token: new URL(url).searchParams.get("join"), nickname: "POS guest" },
    "POST",
    null,
  );
  async function action(path, body, auth = token) {
    const state = await api("/sessions/" + sid, undefined, "GET");
    return api(
      "/sessions/" + sid + path,
      { revision: state.session.revision, ...body },
      "POST",
      auth,
    );
  }
  const item = await action(
    "/orders",
    {
      productId: product.id,
      productVersion: 1,
      quantity: 1,
      optionIds: [],
      note: "",
    },
    guest.accessToken,
  );
  await action("/orders/" + item.id + "/status", {
    status: "ACCEPTED",
    reason: "",
  });
  await section(page, "POS integration");
  async function delivered() {
    const state = await api(prefix + "/pos", undefined, "GET");
    return (
      state.outbox.length > 0 &&
      state.outbox.every((m) => m.status === "DELIVERED")
    );
  }
  await until(delivered);
  await page
    .getByRole("button", { name: "Compare POS bill", exact: true })
    .click();
  await page
    .getByTestId("pos-report")
    .getByRole("heading", { name: "MATCH", exact: true })
    .waitFor();
  checks.push(
    "Accepted order is delivered and exact bill matches the TEST POS",
  );

  await page.getByText("TEST POS controls", { exact: true }).click();
  await page
    .getByLabel("TEST bill difference in MDL", { exact: true })
    .fill("0.01");
  await page
    .getByRole("button", { name: "Save TEST bill state", exact: true })
    .click();
  await page.getByText("Saved.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Compare POS bill", exact: true })
    .click();
  await page
    .getByTestId("pos-report")
    .getByRole("heading", { name: "MISMATCH", exact: true })
    .waitFor();
  const unchanged = await api("/sessions/" + sid, undefined, "GET");
  assert.equal(unchanged.bill.totalBani, 10001);
  checks.push(
    "One-ban POS discrepancy is visible without changing the customer bill",
  );

  await page
    .getByLabel("TEST bill difference in MDL", { exact: true })
    .fill("0.00");
  await page.getByLabel("Kitchen item", { exact: true }).selectOption(item.id);
  await page
    .getByLabel("Kitchen status", { exact: true })
    .selectOption("READY");
  await page
    .getByRole("button", { name: "Save TEST bill state", exact: true })
    .click();
  await page.getByText("Saved.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Import kitchen status", exact: true })
    .click();
  await until(
    async () =>
      (await api("/sessions/" + sid, undefined, "GET")).items[0].status ===
      "READY",
  );
  checks.push("Kitchen status imports through staff controls");
  await until(delivered);

  await page.getByLabel("Source price in MDL", { exact: true }).fill("125.00");
  await page.getByLabel("Source available", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save TEST source product", exact: true })
    .click();
  await page.getByText("Saved.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Import POS catalog", exact: true })
    .click();
  await until(
    async () =>
      (await api(prefix, undefined, "GET")).menu.products[0].price_bani ===
      12500,
  );
  const menu = await api(prefix, undefined, "GET");
  assert.equal(menu.menu.products[0].available, false);
  assert.equal(
    (await api("/sessions/" + sid, undefined, "GET")).bill.totalBani,
    10001,
  );
  checks.push(
    "Catalog imports price and availability without repricing accepted food",
  );

  await page
    .getByRole("button", { name: "Pause delivery", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "TEST POS · Paused", exact: true })
    .waitFor();
  await action("/orders/" + item.id + "/status", {
    status: "SERVED",
    reason: "",
  });
  await page
    .getByRole("button", { name: "Refresh POS status", exact: true })
    .click();
  await until(async () =>
    (await api(prefix + "/pos", undefined, "GET")).outbox.some(
      (m) => m.status === "PENDING",
    ),
  );
  await page
    .getByRole("button", { name: "Resume delivery", exact: true })
    .click();
  await until(delivered);
  checks.push("Pause and resume retain queued work");

  await page
    .getByLabel("Simulator behavior", { exact: true })
    .selectOption("LOSE_REPLY");
  await page
    .getByRole("button", { name: "Apply simulator behavior", exact: true })
    .click();
  await until(
    async () =>
      (await api(prefix + "/pos", undefined, "GET")).simulation.failure_mode ===
      "LOSE_REPLY",
  );
  const payment = await action(
    "/payments",
    { target: "SELF", guestIds: [], method: "CASH", tipBani: 500 },
    guest.accessToken,
  );
  await action("/payments/" + payment.id + "/confirm", {
    collected: true,
    receivedBani: 11000,
    reference: "",
  });
  await until(delivered);
  const delivery = await api(prefix + "/pos", undefined, "GET");
  assert.ok(delivery.outbox.some((m) => m.attempts === 2));
  await page
    .getByRole("button", { name: "Compare POS bill", exact: true })
    .click();
  await page
    .getByTestId("pos-report")
    .getByRole("heading", { name: "MATCH", exact: true })
    .waitFor();
  checks.push(
    "Lost payment write-back reply retries safely and reconciliation matches",
  );

  await page.getByText("TEST POS controls", { exact: true }).click();
  await page.screenshot({
    path: resolve(output, "pos-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.screenshot({
    path: resolve(output, "pos-mobile.png"),
    fullPage: true,
  });
  checks.push("Integration dashboard fits desktop and mobile screens");
  assert.deepEqual(errors, []);
  checks.push("No uncaught browser errors");
  writeFileSync(
    resolve(output, "result.json"),
    JSON.stringify({ status: "passed", checks }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (e) {
  await page
    .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
    .catch(() => {});
  writeFileSync(
    resolve(output, "result.json"),
    JSON.stringify(
      { status: "failed", checks, error: e.message, errors },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
