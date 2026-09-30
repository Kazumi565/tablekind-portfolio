import { emailCode, section } from "./ui-helpers.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const output = "test-results/accounts";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const errors = [],
  checks = [];
const fixturePassword = "Accounts-Fixture-Password!";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
async function page(path, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
  });
  const p = await context.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + path);
  return p;
}
async function staffLogin(p, email, password) {
  await p.getByLabel("Email", { exact: true }).fill(email);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function api(p, path, body, method = "POST", storageKey = "staff") {
  return p.evaluate(
    async ({ path, body, method, storageKey }) => {
      const token = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      )?.accessToken;
      const r = await fetch("/api" + path, {
        method,
        headers: {
          ...(token ? { Authorization: "Bearer " + token } : {}),
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: method === "GET" ? undefined : JSON.stringify(body),
      });
      return { status: r.status, body: await r.json() };
    },
    { path, body, method, storageKey },
  );
}
async function ok(...args) {
  const r = await api(...args);
  assert.equal(r.status, 200, r.body.message);
  return r.body;
}
async function fits(p) {
  assert(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Mobile layout must fit",
  );
}

try {
  const owner = await page("/manage", 1280);
  await staffLogin(
    owner,
    process.env.TEST_STAFF_EMAIL ?? "manager@tablekind.test",
    process.env.TEST_STAFF_PASSWORD ?? "Local-Review-2026!",
  );
  await owner
    .getByRole("heading", { name: "Restaurant overview", exact: true })
    .waitFor();
  const restaurant = await ok(owner, "/restaurants", {
    name: "Accounts review " + suffix,
  });
  const prefix = "/restaurants/" + restaurant.id;
  const branch = await ok(owner, prefix + "/branches", {
    name: "Review branch",
    timezone: "Europe/Chisinau",
    approvalRequired: true,
    acceptingOrders: true,
    hours: [],
  });
  const table = await ok(owner, prefix + "/branches/" + branch.id + "/tables", {
    label: "Accounts table",
    pilotEnabled: true,
    maxGuests: 20,
  });
  const category = await ok(owner, prefix + "/categories", {
    names: { en: "Fixture food" },
    sortOrder: 0,
  });
  await ok(owner, prefix + "/products", {
    categoryId: category.id,
    names: { en: "Fixture meal" },
    descriptions: { en: "Test only" },
    allergens: [],
    dietaryLabels: [],
    priceBani: 10001,
    available: true,
  });
  const waiterEmail = `waiter-${suffix}@example.test`;
  await ok(owner, prefix + "/staff", {
    email: waiterEmail,
    displayName: "Fixture waiter",
    password: fixturePassword,
    role: "WAITER",
  });
  const managerEmail = `manager-${suffix}@example.test`;
  await ok(owner, prefix + "/staff", {
    email: managerEmail,
    displayName: "Fixture manager",
    password: fixturePassword,
    role: "MANAGER",
  });
  await owner.getByRole("button", { name: "Refresh", exact: true }).click();
  await owner
    .getByLabel("Restaurant", { exact: true })
    .selectOption(restaurant.id);
  await owner.screenshot({
    path: output + "/manager-desktop.png",
    fullPage: true,
  });
  checks.push(
    "Owner management overview and separate individual staff accounts",
  );

  const waiter = await page("/staff");
  await staffLogin(waiter, waiterEmail, fixturePassword);
  await waiter
    .getByRole("heading", { name: restaurant.name, exact: true })
    .waitFor();
  assert.equal(
    await waiter
      .getByRole("button", { name: "Restaurant setup", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await waiter
      .getByRole("button", { name: "System status", exact: true })
      .count(),
    0,
  );
  assert.equal((await api(waiter, prefix + "/products", {})).status, 403);
  assert.equal(
    (await api(waiter, "/platform/overview", undefined, "GET")).status,
    403,
  );
  await fits(waiter);
  await waiter.screenshot({
    path: output + "/waiter-phone.png",
    fullPage: true,
  });
  checks.push(
    "Waiter interface omits management and API rejects elevated actions",
  );

  const manager = await page("/manage");
  await staffLogin(manager, managerEmail, fixturePassword);
  await manager
    .getByRole("button", { name: "Restaurant setup", exact: true })
    .click();
  await manager.getByRole("button", { name: "staff", exact: true }).click();
  assert.equal(
    await manager
      .locator('select[name="role"] option[value="MANAGER"]')
      .count(),
    0,
  );
  assert.equal(
    await manager
      .getByRole("button", { name: "Transfer ownership", exact: true })
      .count(),
    0,
  );
  await fits(manager);
  checks.push(
    "Manager sees advanced settings while owner-only controls remain unavailable",
  );

  const opened = await ok(
    owner,
    prefix + "/tables/" + table.id + "/sessions",
    {},
  );
  const guest = await page("/?join=" + encodeURIComponent(opened.joinToken));
  await guest
    .getByLabel("Your nickname", { exact: true })
    .fill("Guest fixture");
  await guest.getByRole("button", { name: "Join table", exact: true }).click();
  await guest
    .getByRole("heading", { name: "Something for everyone", exact: true })
    .waitFor();
  const original = await guest.evaluate(() =>
    JSON.parse(sessionStorage.getItem("guest")),
  );
  const panel = guest.locator(".customer-panel");
  await section(guest, "My account");
  await panel
    .getByRole("button", { name: "Create optional account", exact: true })
    .click();
  const username = "account_" + suffix;
  await panel.getByLabel("Username", { exact: true }).fill(username);
  const emailEnabled = await panel
    .getByLabel("Email address", { exact: true })
    .count();
  const email = `account-${suffix}@example.test`;
  if (emailEnabled)
    await panel.getByLabel("Email address", { exact: true }).fill(email);
  await panel
    .getByLabel("Display name", { exact: true })
    .fill("Account fixture");
  await panel
    .getByLabel("New account password", { exact: true })
    .fill(fixturePassword);
  await panel
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "I saved my recovery code", exact: true })
    .waitFor();
  const stored = await guest.evaluate(() => sessionStorage.getItem("customer"));
  assert(
    !stored.includes("recoveryCode") && !stored.includes(fixturePassword),
    "Only the account session is stored",
  );
  await panel
    .getByRole("button", { name: "I saved my recovery code", exact: true })
    .click();
  if (emailEnabled) {
    await panel
      .getByLabel("Email verification code", { exact: true })
      .fill(await emailCode(email));
    await panel
      .getByRole("button", { name: "Verify email", exact: true })
      .click();
    await panel
      .getByText("Email verified in this demo", { exact: true })
      .waitFor();
  }
  await panel
    .getByRole("button", { name: "Link my current table", exact: true })
    .click();
  await panel
    .getByText("Your current table is linked to this account.", { exact: true })
    .waitFor();
  await fits(guest);
  checks.push(
    "Anonymous QR join remains available and optional account links without changing the guest",
  );

  const second = await page("/guest/account");
  const account = second.locator(".customer-panel");
  await account.getByLabel("Username", { exact: true }).fill(username);
  await account
    .getByLabel("Account password", { exact: true })
    .fill(fixturePassword);
  await account
    .getByRole("button", { name: "Sign in to customer account", exact: true })
    .click();
  await account
    .getByRole("button", { name: "Resume this table", exact: true })
    .click();
  await second.getByRole("button", { name: "My order", exact: true }).waitFor();
  const resumed = await second.evaluate(() =>
    JSON.parse(sessionStorage.getItem("guest")),
  );
  assert.equal(resumed.actorId, original.actorId);
  assert.equal(resumed.sessionId, original.sessionId);
  const state = await ok(
    owner,
    "/sessions/" + opened.sessionId,
    undefined,
    "GET",
  );
  assert.equal(state.guests.length, 1);
  assert.equal(
    (
      await api(
        second,
        "/sessions/" + opened.sessionId,
        undefined,
        "GET",
        "customer",
      )
    ).status,
    403,
  );
  await fits(second);
  checks.push(
    "Independent browser resumes the same guest, with no duplicate and no account-token table authority",
  );

  const admin = await page("/admin");
  await admin
    .getByRole("heading", { name: "Administrator sign in", exact: true })
    .waitFor();
  assert.equal(
    await admin
      .getByRole("button", { name: "Create customer account", exact: true })
      .count(),
    0,
  );
  await fits(admin);
  await admin.screenshot({ path: output + "/admin-phone.png", fullPage: true });
  checks.push(
    "Separate platform sign-in renders on mobile; privileged administrator workflow requires private provisioning",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    output + "/result.json",
    JSON.stringify(
      {
        status: "passed",
        checks,
        platformAuthenticatedBrowser: "not_run_use_private_manual_gate",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (e) {
  writeFileSync(
    output + "/result.json",
    JSON.stringify({ status: "failed", checks, message: e.message }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
