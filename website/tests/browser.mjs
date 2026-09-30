import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { build, root } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";

// Creates a local disposable site only. It never connects to a running restaurant.
const previewConfig = {
  siteUrl: "",
  contactEmail: "",
  operatorName: "",
  hostingProvider: "",
  hostingPrivacyUrl: "",
  enquiryRetentionDays: null,
  publicationReviewed: false,
};
const isolatedOutput = path.join(
  await mkdtemp(path.join(tmpdir(), "tablekind-browser-site-")),
  "dist",
);
await build({ output: isolatedOutput, config: previewConfig });
const results = path.join(root, "test-results");
await mkdir(results, { recursive: true });
const server = await createPreviewServer({
  port: 0,
  directory: isolatedOutput,
});
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
const errors = [];
const securityErrors = [];
const network = [];
const audits = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TABLEKIND_BROWSER_EXECUTABLE
      ? { executablePath: process.env.TABLEKIND_BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      /Content Security Policy|violates|Refused to/.test(msg.text())
    )
      securityErrors.push(msg.text());
  });
  page.on("request", (request) =>
    network.push({ url: request.url(), method: request.method() }),
  );
  async function fits(label) {
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.scroll <= dimensions.width + 1,
      `${label}: horizontal overflow ${JSON.stringify(dimensions)}`,
    );
  }
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/contact.html",
      "/privacy.html",
      "/pilot.html",
      "/404.html",
    ]) {
      await page.goto(origin + route);
      await page.locator("h1").waitFor();
      await fits(`${width} ${route}`);
      assert.equal(await page.locator("h1").count(), 1);
      if (route === "/") {
        for (const step of ["share", "bill", "join"]) {
          await page.locator(`[data-step="${step}"]`).click();
          assert.equal(
            await page
              .locator(`[data-step="${step}"]`)
              .getAttribute("aria-pressed"),
            "true",
          );
          assert.ok(await page.locator(`[data-panel="${step}"]`).isVisible());
          await fits(`${width} ${step}`);
        }
        await page.evaluate(() => scrollTo(0, 0));
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: path.join(results, `homepage-${width}.png`),
            fullPage: true,
          });
      }
    }
  }
  checks.push(
    "Five pages and three walkthrough states fit seven widths from 320 to 1440 pixels.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Skip to content",
  );
  const focus = await page
    .locator(".skip-link")
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  assert.notEqual(focus, "0px");
  await page.keyboard.press("Enter");
  await page.locator('[data-step="share"]').focus();
  await page.keyboard.press("Enter");
  assert.ok(await page.locator('[data-panel="share"]').isVisible());
  await page.locator(".faq summary").first().focus();
  await page.keyboard.press("Enter");
  assert.ok(
    (await page.locator(".faq details").first().getAttribute("open")) !== null,
  );
  checks.push(
    "Skip link, visible keyboard focus, walkthrough selection and native FAQ disclosure work.",
  );
  const animations = await page.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.playState === "running")
      .length,
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  assert.equal(animations.running, 0);
  assert.equal(animations.scroll, "auto");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.locator(".closing").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => !document.querySelector(".closing").classList.contains("is-waiting"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".is-waiting").count(), 0);
  checks.push(
    "Scroll reveal works and changing to reduced motion disables animations and reveals all content.",
  );
  // Run all rules, not just contrast. Scroll/focus behaviours are tested separately above.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/contact.html",
      "/privacy.html",
      "/pilot.html",
      "/404.html",
    ]) {
      await page.goto(origin + route);
      if (route === "/contact.html")
        await page.waitForFunction(
          () => !document.querySelector("#composer-fields").disabled,
        );
      for (const state of route === "/" ? ["join", "share", "bill"] : [null]) {
        if (state) await page.locator(`[data-step="${state}"]`).click();
        const audit = await new AxeBuilder({ page }).analyze();
        audits.push({
          width,
          route,
          state,
          violations: audit.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          incomplete: audit.incomplete.map((v) => ({
            id: v.id,
            count: v.nodes.length,
            targets: v.nodes.map((n) => n.target),
          })),
        });
      }
    }
  }
  await writeFile(
    path.join(results, "accessibility.json"),
    JSON.stringify(audits, null, 2),
  );
  assert.equal(
    audits.reduce((sum, a) => sum + a.violations.length, 0),
    0,
    `Accessibility violations: ${JSON.stringify(audits.filter((a) => a.violations.length))}`,
  );
  checks.push(
    "Axe accessibility checks report zero violations across five pages at mobile and desktop sizes (not a manual accessibility certification).",
  );
  await page.goto(origin + "/contact.html");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole("button", { name: "Prepare my enquiry" }).click();
  assert.ok(await page.locator("#draft").isHidden());
  await page.getByLabel("Your name", { exact: true }).fill("Fixture visitor");
  await page
    .getByLabel("Restaurant", { exact: true })
    .fill("Fixture restaurant");
  await page.getByLabel("City", { exact: true }).fill("Chișinău");
  await page
    .getByLabel("What would you like to explore?", { exact: false })
    .fill("<script>not executed</script> Shared dishes & busy tables.");
  await page.getByRole("button", { name: "Prepare my enquiry" }).dblclick();
  // Includes the deferred scroll that protects against a second tap hitting Clear.
  await page.waitForTimeout(400);
  assert.ok(
    await page
      .getByRole("heading", { name: "Your draft is ready. Not sent." })
      .isVisible(),
  );
  assert.equal(await page.locator("#draft").count(), 1);
  await fits("320 expanded enquiry draft");
  assert.ok(await page.locator("#open-email").isHidden());
  assert.match(
    await page.locator("#draft-text").inputValue(),
    /<script>not executed<\/script>/,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied fixture");
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Copy draft" }).click();
  assert.match(await page.locator("#draft-feedback").textContent(), /manually/);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.getByRole("button", { name: "Copy draft" }).click();
  assert.match(await page.locator("#draft-feedback").textContent(), /^Copied/);
  const draftAudit = await new AxeBuilder({ page }).analyze();
  assert.equal(
    draftAudit.violations.length,
    0,
    JSON.stringify(draftAudit.violations),
  );
  await page.getByLabel("City", { exact: true }).fill("Bălți");
  assert.ok(await page.locator("#draft").isHidden());
  await page.getByRole("button", { name: "Prepare my enquiry" }).click();
  assert.match(await page.locator("#draft-text").inputValue(), /Bălți/);
  await page.getByRole("button", { name: "Clear form" }).click();
  assert.equal(
    await page.getByLabel("Your name", { exact: true }).inputValue(),
    "",
  );
  assert.ok(await page.locator("#draft").isHidden());
  assert.deepEqual(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
    { local: 0, session: 0, cookies: "" },
  );
  checks.push(
    "Draft form validates, tolerates double clicks, renders input as text, handles clipboard success/denial, invalidates edits and clears without storage or submission.",
  );
  const configuredOutput = path.join(
    await mkdtemp(path.join(tmpdir(), "tablekind-configured-site-")),
    "dist",
  );
  await build({
    output: configuredOutput,
    config: { ...previewConfig, contactEmail: "demo@example.test" },
  });
  const configuredServer = await createPreviewServer({
    directory: configuredOutput,
    port: 0,
  });
  try {
    await page.goto(
      `http://127.0.0.1:${configuredServer.address().port}/contact.html`,
    );
    await page.getByLabel("Your name", { exact: true }).fill("Fixture");
    await page
      .getByLabel("Restaurant", { exact: true })
      .fill("Fixture restaurant");
    await page.getByLabel("City", { exact: true }).fill("Chișinău");
    await page.getByRole("button", { name: "Prepare my enquiry" }).click();
    const mailto = await page.locator("#open-email").getAttribute("href");
    assert.match(mailto, /^mailto:demo%40example.test\?subject=/);
    assert.match(decodeURIComponent(mailto), /City: Chișinău/);
    // Inspect only. Never invoke an actual mail application or send a message.
  } finally {
    await new Promise((r) => configuredServer.close(r));
  }
  checks.push(
    "A configured fictional mailbox produces an encoded mailto draft; no email was sent or delivery claimed.",
  );
  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 360, height: 800 },
  });
  const plain = await noScript.newPage();
  await plain.goto(origin + "/");
  assert.ok(await plain.getByRole("heading", { level: 1 }).isVisible());
  await plain.getByRole("link", { name: /Request a guided demo/ }).click();
  assert.ok(await plain.locator("#composer-unavailable").isVisible());
  assert.ok(
    await plain
      .getByRole("button", { name: "Prepare my enquiry" })
      .isDisabled(),
  );
  await noScript.close();
  checks.push(
    "Without JavaScript, content and navigation remain available and the unsendable form is disabled.",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(securityErrors.length, 0, securityErrors.join("\n"));
  assert.ok(
    network.every(
      (r) => new URL(r.url).hostname === "127.0.0.1" && r.method === "GET",
    ),
  );
  checks.push(
    "No uncaught page errors, CSP violations, third-party requests or outgoing form submissions observed.",
  );
  const report = {
    status: "passed",
    browser: await browser.version(),
    checks,
    viewports: [320, 360, 390, 430, 768, 1024, 1440],
    accessibility: {
      pages: 5,
      widths: [390, 1440],
      violations: 0,
      manualReviewStillRequired: true,
    },
  };
  await writeFile(
    path.join(results, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await writeFile(
    path.join(results, "result.json"),
    JSON.stringify(
      { status: "failed", completedChecks: checks, error: error.message },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
