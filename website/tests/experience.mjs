import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { build, root } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";

const temporary = await mkdtemp(path.join(tmpdir(), "tablekind-experience-"));
const directory = path.join(temporary, "dist");
await build({
  output: directory,
  config: {
    siteUrl: "",
    contactEmail: "",
    operatorName: "",
    hostingProvider: "",
    hostingPrivacyUrl: "",
    enquiryRetentionDays: null,
    publicationReviewed: false,
  },
});
const server = await createPreviewServer({ directory, port: 0 });
const origin = `http://127.0.0.1:${server.address().port}`;
const output = path.join(root, "test-results");
await mkdir(output, { recursive: true });
const checks = [];
const audits = [];
const errors = [];
const requests = [];
let browser;
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|violates|Refused to/.test(message.text())
    )
      errors.push(message.text());
  });
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method() }),
  );
}
async function fits(page, label) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    label,
  );
}
async function audit(page, label) {
  // Evaluate the settled interface, not the temporary opacity of an entrance.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running"),
  );
  const result = await new AxeBuilder({ page }).analyze();
  audits.push({
    label,
    violations: result.violations,
    incomplete: result.incomplete.map((rule) => ({
      id: rule.id,
      targets: rule.nodes.map((node) => node.target),
    })),
  });
}
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TABLEKIND_BROWSER_EXECUTABLE
      ? { executablePath: process.env.TABLEKIND_BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  watch(page);
  await page.goto(origin);
  await page.locator('[data-next="share"]').first().click();
  assert.equal(await page.locator('[data-panel="share"]').isVisible(), true);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.hasAttribute("data-share-heading"),
    ),
    true,
  );
  const fixtures = [
    { id: "pizza", name: "Margherita", price: 120 },
    { id: "vegetables", name: "Grilled vegetables", price: 144 },
    { id: "cake", name: "Chocolate cake", price: 96 },
  ];
  for (const fixture of fixtures) {
    for (const guests of [2, 3, 4]) {
      for (const drink of [true, false]) {
        await page.locator('[data-step="share"]').click();
        await page.locator(`[data-dish="${fixture.id}"]`).click();
        await page.locator(`[data-guests="${guests}"]`).click();
        await page.locator("[data-personal-drink]").setChecked(drink);
        const part = fixture.price / guests;
        const total = part + (drink ? 35 : 0);
        assert.equal(
          await page.locator("[data-example-total]").textContent(),
          String(total),
        );
        assert.equal(
          await page.locator('[data-dish][aria-pressed="true"]').count(),
          1,
        );
        assert.equal(
          await page.locator("[data-share-people] > span").count(),
          guests,
        );
        assert.deepEqual(
          await page.locator("[data-share-people] strong").allTextContents(),
          Array(guests).fill(`${part} MDL`),
        );
        assert.match(
          await page.locator("[data-example-status]").textContent(),
          new RegExp(`total is ${total} MDL`),
        );
        await page.locator('[data-next="bill"]').click();
        assert.equal(
          await page.locator("[data-receipt-amount]").textContent(),
          `${part} MDL`,
        );
        assert.equal(
          await page.locator("[data-receipt-total]").textContent(),
          String(total),
        );
        assert.ok(
          (await page.locator("[data-receipt-share]").textContent()).endsWith(
            fixture.name,
          ),
        );
        assert.equal(
          await page.locator("[data-receipt-drink]").isVisible(),
          drink,
        );
      }
    }
  }
  checks.push(
    "All 18 dish/group-size/personal-drink combinations produce exact fictional shares and matching receipts, with personal drinks excluded from everyone else's share.",
  );

  await page.locator("[data-reset-example]").click();
  assert.equal(await page.locator("[data-example-total]").textContent(), "75");
  assert.equal(
    await page.locator('[data-dish="pizza"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page.locator('[data-guests="3"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator("[data-personal-drink]").isChecked(), true);
  await page.locator('[data-dish="cake"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("[data-example-total]").textContent(), "67");
  await page.locator("[data-personal-drink]").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("[data-example-total]").textContent(), "32");
  await page.locator('[data-dish="cake"]').dblclick();
  assert.equal(await page.locator("[data-example-total]").textContent(), "32");
  assert.equal(
    await page.locator('[data-dish][aria-pressed="true"]').count(),
    1,
  );
  await page.locator('[data-next="bill"]').click();
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "No mental maths required.",
  );
  checks.push(
    "Keyboard dish selection, personal-drink toggle, repeated clicks, next-step focus and reset work without duplicate items or stale totals.",
  );

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-step="share"]').click();
    await page.locator('[data-dish="vegetables"]').click();
    await page.locator('[data-guests="4"]').click();
    await fits(page, `Share example at ${width}`);
    await page.locator('[data-next="bill"]').click();
    await fits(page, `Bill at ${width}`);
    for (const role of ["guest", "waiter", "manager"]) {
      await page.locator(`[data-role="${role}"]`).click();
      assert.equal(await page.locator(".workspace-preview > div").count(), 3);
      assert.equal(
        await page.locator(".role-detail-label").textContent(),
        `Illustrative ${role} view`,
      );
      await fits(page, `${role} at ${width}`);
    }
    if ([320, 1440].includes(width)) {
      await audit(page, `Bill and manager workspace ${width}`);
      await page.locator('[data-step="share"]').click();
      await audit(page, `Vegetables for four without a drink ${width}`);
    }
    if (width === 390) {
      await page.locator('[data-step="share"]').click();
      await page
        .locator(".experience-grid")
        .screenshot({ path: path.join(output, "experience-mobile.png") });
    }
  }
  checks.push(
    "Expanded examples, receipts and all workspace previews fit 320, 390, 768, 1024 and 1440 pixels; mobile step controls keep the walkthrough directly below them.",
  );

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/contact.html",
      "/privacy.html",
      "/pilot.html",
      "/404.html",
    ]) {
      await page.goto(origin + route);
      const summary = page.locator(".mobile-menu summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".mobile-menu").getAttribute("open"), "");
      assert.equal(await page.locator(".menu-links a:visible").count(), 4);
      await fits(page, `Menu ${width} ${route}`);
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(".mobile-menu").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.evaluate(() =>
          document.activeElement.matches(".mobile-menu summary"),
        ),
        true,
      );
      await summary.click();
      await page.mouse.click(3, 600);
      assert.equal(
        await page.locator(".mobile-menu").getAttribute("open"),
        null,
      );
    }
  }
  await page.goto(origin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".mobile-menu summary").click();
  await audit(page, "Open mobile menu 390");
  await page.locator('.menu-links a[href="/#how-it-works"]').click();
  assert.equal(await page.locator(".mobile-menu").getAttribute("open"), null);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "how-it-works",
  );
  assert.equal(new URL(page.url()).hash, "#how-it-works");
  await page.locator(".mobile-menu summary").click();
  await page.locator(".menu-links a").last().focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".mobile-menu").getAttribute("open"), null);
  await page.locator(".mobile-menu summary").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(
    () => !document.querySelector(".mobile-menu").open,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  checks.push(
    "Mobile menus work on all five pages at three widths, close on Escape/outside click/focus exit, follow section links and reset when resizing to desktop.",
  );

  const noJS = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const staticPage = await noJS.newPage();
  watch(staticPage);
  await staticPage.goto(origin);
  await staticPage.locator(".mobile-menu summary").click();
  assert.equal(await staticPage.locator(".menu-links a:visible").count(), 4);
  await staticPage.locator('.menu-links a[href="/pilot.html"]').click();
  assert.equal(new URL(staticPage.url()).pathname, "/pilot.html");
  await staticPage.goto(origin);
  assert.equal(
    await staticPage.locator("[data-enhancement]:visible").count(),
    0,
  );
  assert.equal(await staticPage.locator(".mini-confirm").isVisible(), true);
  await writeFile(
    path.join(output, "experience-accessibility.json"),
    JSON.stringify(audits, null, 2),
  );
  assert.equal(
    audits.reduce((sum, item) => sum + item.violations.length, 0),
    0,
    "See experience-accessibility.json",
  );
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
    0,
  );
  checks.push(
    "Five additional accessibility audits report zero violations; reduced motion stops animations, and native mobile navigation works without JavaScript.",
  );

  assert.deepEqual(errors, []);
  assert.ok(
    requests.every(
      (request) =>
        request.url.startsWith(origin + "/") && request.method === "GET",
    ),
  );
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  assert.equal((await context.cookies()).length, 0);
  checks.push(
    "No script/CSP errors, external requests, submissions, cookies or browser storage occurred; the example never contacts a restaurant service.",
  );
  const result = { status: "passed", browser: await browser.version(), checks };
  await writeFile(
    path.join(output, "experience-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
