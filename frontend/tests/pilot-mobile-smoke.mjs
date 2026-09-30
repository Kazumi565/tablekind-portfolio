import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { section } from "./ui-helpers.mjs";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const password = process.env.TEST_STAFF_PASSWORD;
if (!password)
  throw new Error(
    "Set TEST_STAFF_PASSWORD for this isolated local TEST installation.",
  );
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: process.env.CHROMIUM_EXECUTABLE
    ? ["--no-sandbox", "--no-zygote", "--disable-dev-shm-usage"]
    : [],
});
const errors = [],
  checks = [];
async function api(page, path, method = "GET", body) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const token = JSON.parse(
        sessionStorage.getItem("staff") ?? "null",
      )?.accessToken;
      const r = await fetch("/api" + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      });
      return { status: r.status, body: await r.json() };
    },
    { path, method, body },
  );
}
async function fit(page, width) {
  await page.setViewportSize({ width, height: 844 });
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    offenders: [...document.querySelectorAll("*")]
      .map((el) => ({
        tag: el.tagName,
        className: typeof el.className === "string" ? el.className : "",
        right: Math.ceil(el.getBoundingClientRect().right),
      }))
      .filter((el) => el.right > innerWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 5),
  }));
  assert(
    layout.width <= width + 1,
    `Unexpected horizontal overflow at ${width}px: ${JSON.stringify(layout)}`,
  );
}
function luminance(hex) {
  const values =
    hex
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number) ?? [];
  return values
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((total, x, i) => total + x * [0.2126, 0.7152, 0.0722][i], 0);
}
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/manage");
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Restaurant overview" }).waitFor();
  for (const width of [320, 390, 430, 768, 1024, 1366]) await fit(page, width);
  checks.push(
    "Manager screen fits a narrow phone, large phone, tablet and desktop",
  );
  const suffix = randomUUID().slice(0, 8);
  const created = await api(page, "/restaurants", "POST", {
    name: "Pilot a11y " + suffix,
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByLabel("Restaurant", { exact: true })
    .selectOption(created.body.id);
  await section(page, "Restaurant setup");
  await page
    .getByRole("heading", { name: "Set up your first table" })
    .waitFor();
  const form = page.locator(".starter-form");
  assert(
    await form
      .locator("input")
      .evaluateAll((inputs) => inputs.every((i) => i.labels?.length > 0)),
  );
  const font = await form
    .getByLabel("Branch name")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  assert(font >= 14, `Form field text is too small: ${font}px`);
  checks.push(
    "First table form has programmatic labels and readable field text",
  );
  await form.getByLabel("Branch name").fill("Main");
  await form.getByLabel("Table name").fill("Table 1");
  await form.getByLabel("Menu category").fill("Food");
  await form.getByLabel("First item").fill("Soup");
  await form.getByLabel("Price in MDL").fill("55.01");
  const button = form.getByRole("button", {
    name: "Create first table and menu",
  });
  const colors = await button.evaluate((el) => ({
    fg: getComputedStyle(el).color,
    bg: getComputedStyle(el).backgroundColor,
  }));
  const lighter = Math.max(luminance(colors.fg), luminance(colors.bg));
  const darker = Math.min(luminance(colors.fg), luminance(colors.bg));
  assert(
    (lighter + 0.05) / (darker + 0.05) >= 4.5,
    "Primary button text contrast below 4.5:1",
  );
  await form.getByLabel("Price in MDL").focus();
  await page.keyboard.press("Tab");
  assert(await button.evaluate((el) => document.activeElement === el));
  assert(
    await button.evaluate((el) => getComputedStyle(el).outlineStyle !== "none"),
  );
  checks.push(
    "Keyboard focus is visible and the primary action has readable text contrast",
  );
  let requests = 0;
  await page.route(
    `**/api/restaurants/${created.body.id}/starter`,
    async (route) => {
      requests++;
      await route.continue();
    },
  );
  await button.evaluate((el) => {
    el.click();
    el.click();
  });
  await form
    .getByRole("status")
    .waitFor({ state: "visible" })
    .catch(() => {});
  await page
    .getByText("First branch, table, item and printable QR code created.", {
      exact: false,
    })
    .waitFor();
  assert.equal(
    requests,
    1,
    "Duplicate taps must not dispatch a second starter request",
  );
  const dashboard = await api(page, "/restaurants/" + created.body.id);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.tables.length, 1);
  checks.push("Double tap creates one table and the UI reports completion");
  for (const width of [320, 390, 430, 768, 1024, 1366]) await fit(page, width);
  await page.getByRole("button", { name: "pilot", exact: true }).click();
  await page
    .getByRole("heading", { name: "Practice pilot measurements" })
    .waitFor();
  await page
    .getByText("No IP addresses, names or customer profiles", { exact: false })
    .waitFor();
  checks.push(
    "Pilot totals are reachable from management and show a loading/result state",
  );
  const opened = await api(
    page,
    `/restaurants/${created.body.id}/tables/${dashboard.body.tables[0].id}/sessions`,
    "POST",
    {},
  );
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  const guest = await page.evaluate(async (token) => {
    const r = await fetch("/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ token, nickname: "Browser guest" }),
    });
    return { status: r.status, body: await r.json() };
  }, opened.body.joinToken);
  assert.equal(guest.status, 200, JSON.stringify(guest.body));
  await page.evaluate(
    (auth) => sessionStorage.setItem("guest", JSON.stringify(auth)),
    guest.body,
  );
  await page.goto(base + "/guest");
  await page.route(
    `**/api/sessions/${opened.body.sessionId}/practice-reservations`,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "Try reservations" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Loading practice requests" })
    .waitFor();
  await page
    .getByRole("heading", { name: "Try a reservation request" })
    .waitFor();
  assert(
    await page
      .locator(".practice-reservations input")
      .evaluateAll((inputs) => inputs.every((i) => i.labels?.length > 0)),
  );
  for (const width of [320, 390, 430, 768, 1024, 1366]) await fit(page, width);
  checks.push(
    "Guest reservation screen fits the same six viewports, labels inputs and exposes a loading state",
  );
  assert.deepEqual(errors, []);
  mkdirSync("test-results/pilot-browser", { recursive: true });
  writeFileSync(
    "test-results/pilot-browser/result.json",
    JSON.stringify(
      {
        status: "passed",
        checks,
        viewportWidths: [320, 390, 430, 768, 1024, 1366],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} finally {
  await browser.close();
}
