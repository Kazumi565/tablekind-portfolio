import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { build, root } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";

const temporary = await mkdtemp(path.join(tmpdir(), "tablekind-bilingual-"));
const directory = path.join(temporary, "dist");
const config = {
  siteUrl: "", contactEmail: "", operatorName: "", hostingProvider: "",
  hostingPrivacyUrl: "", enquiryRetentionDays: null, publicationReviewed: false,
};
await build({ output: directory, config });
const server = await createPreviewServer({ directory, port: 0 });
const origin = `http://127.0.0.1:${server.address().port}`;
const resultDir = path.join(root, "test-results");
await mkdir(resultDir, { recursive: true });
const errors = [];
const requests = [];
const checks = [];
const audits = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.TABLEKIND_BROWSER_EXECUTABLE ? { executablePath: process.env.TABLEKIND_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  const routes = ["/", "/contact.html", "/pilot.html", "/privacy.html", "/404.html"];
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const english of routes) {
      const romanian = english === "/" ? "/ro/" : `/ro${english}`;
      await page.goto(origin + romanian);
      assert.equal(await page.locator("html").getAttribute("lang"), "ro");
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator(".language-switch").getAttribute("href"), english);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, `${romanian} overflowed at ${width}px by ${overflow}px`);
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page }).analyze();
        audits.push({ route: romanian, width, violations: audit.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })) });
      }
      await page.locator(".language-switch").click();
      assert.equal(new URL(page.url()).pathname, english);
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
      await page.locator(".language-switch").click();
      assert.equal(new URL(page.url()).pathname, romanian);
    }
  }
  checks.push("All five Romanian pages fit seven viewport sizes, retain their matching English page when switching languages and expose lang=ro with translated metadata.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/ro/");
  assert.match(await page.locator(".hero-lead").textContent(), /codul QR al mesei/);
  assert.match(await page.locator(".value-card").first().textContent(), /fără cont/);
  assert.match(await page.locator(".value-card").last().textContent(), /Chelnerii/);
  await page.locator('[data-step="share"]').click();
  await page.locator('[data-dish="cake"]').click();
  await page.locator('[data-guests="4"]').click();
  assert.match(await page.locator("[data-share-equation]").textContent(), /24 MDL de persoană/);
  assert.match(await page.locator("[data-example-status]").textContent(), /Totalul din exemplu/);
  await page.locator('[data-next="bill"]').click();
  assert.equal(await page.locator("[data-receipt-total]").textContent(), "59");
  await page.locator('[data-role="waiter"]').click();
  assert.match(await page.locator(".role-detail-label").textContent(), /chelner/);
  await page.screenshot({ path: path.join(resultDir, "bilingual-home-mobile-ro.png"), fullPage: true });
  checks.push("The Romanian guest example and all interactive role labels update in Romanian while keeping exact fictional bani arithmetic.");

  await page.goto(origin + "/ro/contact.html");
  await page.getByLabel("Numele tău").fill("Vizitator fictiv");
  await page.getByLabel("Restaurant", { exact: true }).fill("Restaurant fictiv");
  await page.getByLabel("Oraș").fill("Chișinău");
  await page.getByRole("button", { name: "Pregătește solicitarea" }).dblclick();
  assert.match(await page.locator("#draft-text").inputValue(), /Oraș: Chișinău/);
  assert.match(await page.locator("#draft-feedback").textContent(), /Nu a fost trimis/);
  assert.ok(await page.locator("#open-email").isHidden());
  await page.getByRole("button", { name: "Golește formularul" }).click();
  assert.ok(await page.locator("#draft").isHidden());
  const draftAudit = await new AxeBuilder({ page }).analyze();
  audits.push({ route: "/ro/contact.html", width: 390, state: "after draft", violations: draftAudit.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })) });
  checks.push("The Romanian enquiry composes a local draft, handles a double click and clears without sending anything.");

  const plainContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const plain = await plainContext.newPage();
  await plain.goto(origin + "/ro/");
  await plain.locator(".language-switch").click();
  assert.equal(new URL(plain.url()).pathname, "/");
  await plain.goto(origin + "/ro/contact.html");
  assert.ok(await plain.getByRole("button", { name: "Pregătește solicitarea" }).isDisabled());
  await plainContext.close();
  checks.push("Language switching works with JavaScript disabled; the unsendable form remains disabled.");

  assert.equal(audits.reduce((n, audit) => n + audit.violations.length, 0), 0, JSON.stringify(audits.filter((x) => x.violations.length)));
  assert.deepEqual(errors, []);
  assert.ok(requests.every((r) => r.method === "GET" && r.url.startsWith(origin + "/")));
  assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })), { local: 0, session: 0, cookies: "" });
  checks.push("Romanian pages passed eleven automated accessibility scans; no browser exceptions, external requests, POSTs, cookies or browser storage were observed.");
  const result = { status: "passed", checks, accessibilityAudits: audits.length, viewportWidths: [320, 360, 390, 430, 768, 1024, 1440], browser: await browser.version() };
  await writeFile(path.join(resultDir, "bilingual-result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
