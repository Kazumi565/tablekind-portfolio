import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { emailCode } from "./ui-helpers.mjs";
const base = process.env.TEST_APP_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);
const checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const output = "test-results/email";
mkdirSync(output, { recursive: true });
const username = "email_" + Date.now(),
  email = username + "@example.test",
  password = "Email-Browser-Fixture!",
  replacement = "Replacement-Browser-Fixture!";
try {
  await page.route("**/api/customer/email/config", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Temporarily unavailable" }),
    }),
  );
  await page.goto(base + "/guest/account");
  await page
    .getByRole("button", { name: "Retry account settings", exact: true })
    .waitFor();
  await page.unroute("**/api/customer/email/config");
  await page
    .getByRole("button", { name: "Retry account settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .waitFor();
  checks.push(
    "Account configuration failures have a visible retry and recover",
  );
  const panel = page.locator(".customer-panel");
  await panel
    .getByRole("button", { name: "Create optional account", exact: true })
    .click();
  await panel.getByLabel("Username", { exact: true }).fill(username);
  await panel.getByLabel("Email address", { exact: true }).fill(email);
  await panel.getByLabel("Display name", { exact: true }).fill("Email fixture");
  await panel
    .getByLabel("New account password", { exact: true })
    .fill(password);
  await panel
    .getByRole("button", { name: "Create customer account", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "I saved my recovery code", exact: true })
    .click();
  const code = await emailCode(email);
  await panel
    .getByLabel("Email verification code", { exact: true })
    .fill(code === "00000000" ? "11111111" : "00000000");
  await panel
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  await panel
    .getByRole("alert")
    .filter({ hasText: "invalid or expired" })
    .waitFor();
  await panel.getByLabel("Email verification code", { exact: true }).fill(code);
  await panel
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  await panel
    .getByText("Email verified in this demo", { exact: true })
    .waitFor();
  checks.push(
    "Real local SMTP delivery reaches Mailpit; wrong code fails and correct code verifies",
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: output + "/verified-phone.png",
    fullPage: true,
  });
  const oldToken = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("customer")).accessToken,
  );
  // A new browser tab exercises the actual forgotten-password form without relying on the saved session.
  const recovery = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  recovery.on("pageerror", (e) => errors.push(e.message));
  await recovery.goto(base + "/guest/account");
  await recovery
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await recovery.getByLabel("Username", { exact: true }).fill(username);
  await recovery.getByLabel("Verified email", { exact: true }).fill(email);
  await recovery
    .getByRole("button", { name: "Send password reset code", exact: true })
    .click();
  await recovery
    .getByLabel("Password reset code", { exact: true })
    .fill(await emailCode(email, "reset your password"));
  await recovery
    .getByLabel("New account password", { exact: true })
    .fill(replacement);
  await recovery
    .getByRole("button", { name: "Reset password with email", exact: true })
    .click();
  await recovery
    .getByText(
      "Password changed. Sign in and save a new recovery code in account security.",
      { exact: true },
    )
    .waitFor();
  const revoked = await page.request.get(base + "/api/customer/me", {
    headers: { Authorization: "Bearer " + oldToken },
  });
  assert.equal(revoked.status(), 401);
  await recovery.getByLabel("Username", { exact: true }).fill(username);
  await recovery
    .getByLabel("Account password", { exact: true })
    .fill(replacement);
  await recovery
    .getByRole("button", { name: "Sign in to customer account", exact: true })
    .click();
  await recovery
    .getByText("Email verified in this demo", { exact: true })
    .waitFor();
  checks.push(
    "Email reset signs in with the new password and rejects the old account session",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    output + "/results.json",
    JSON.stringify({ status: "passed", checks }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (e) {
  // Codes and private account forms are never captured on failure.
  writeFileSync(
    output + "/results.json",
    JSON.stringify({ status: "failed", checks, message: e.message }, null, 2) +
      "\n",
  );
  throw e;
} finally {
  await browser.close();
}
