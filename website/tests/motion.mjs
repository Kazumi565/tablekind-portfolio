import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { build, root } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";

const temporary = await mkdtemp(path.join(tmpdir(), "tablekind-motion-"));
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
const results = path.join(root, "test-results");
await mkdir(results, { recursive: true });
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
async function settled(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function progress(page, value) {
  await page.evaluate((value) => {
    const story = document.querySelector(".hero-story");
    const hero = story.querySelector(".hero");
    const start = story.getBoundingClientRect().top + scrollY - 92;
    scrollTo({
      top: start + value * (story.offsetHeight - hero.offsetHeight),
      behavior: "instant",
    });
  }, value);
  await settled(page);
}
async function sceneState(page) {
  return page.locator(".table-scene").evaluate((scene) => {
    const rect = (el) => el.getBoundingClientRect().toJSON();
    const phone = scene.querySelector(".phone");
    return {
      enabled: document.body.classList.contains("story-enabled"),
      phone: rect(phone),
      matrix: getComputedStyle(phone).transform,
      notes: [...scene.querySelectorAll(".floating-note")].map((note) => ({
        ...rect(note),
        opacity: Number(getComputedStyle(note).opacity),
      })),
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}
async function fits(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must not overflow horizontally",
  );
}
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TABLEKIND_BROWSER_EXECUTABLE
      ? { executablePath: process.env.TABLEKIND_BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  watch(page);
  await page.goto(origin);
  await page.waitForFunction(() =>
    document.body.classList.contains("story-enabled"),
  );
  await page.waitForTimeout(1100); // Let the one-time entrance finish before screenshots.
  await progress(page, 0);
  const start = await sceneState(page);
  assert.ok(start.notes.every((note) => note.opacity === 0));
  await page.screenshot({
    path: path.join(results, "motion-desktop-start.png"),
  });
  await progress(page, 0.48);
  const middle = await sceneState(page);
  assert.ok(
    middle.notes[0].opacity > 0.95 &&
      middle.notes[1].opacity > 0 &&
      middle.notes[2].opacity === 0,
  );
  assert.ok(middle.phone.x < start.phone.x);
  await page.screenshot({
    path: path.join(results, "motion-desktop-middle.png"),
  });
  await progress(page, 1);
  const end = await sceneState(page);
  assert.ok(end.notes.every((note) => note.opacity === 1));
  assert.match(end.matrix, /^matrix\(1, 0, 0, 1, -110, 0\)$/);
  for (const [index, note] of end.notes.entries()) {
    assert.ok(
      note.left >= end.phone.right,
      "Settled cards must not cover phone content",
    );
    assert.ok(note.right <= end.width, "Cards must stay inside viewport");
    assert.equal(
      note.left,
      end.notes[0].left,
      "All three cards align vertically",
    );
    if (index) assert.ok(note.top > end.notes[index - 1].bottom);
  }
  await page.screenshot({ path: path.join(results, "motion-desktop-end.png") });
  await progress(page, 0);
  assert.ok((await sceneState(page)).notes.every((note) => note.opacity === 0));
  checks.push(
    "Desktop story reveals three cards sequentially, settles them vertically clear of the phone and reverses on upward scrolling.",
  );

  await progress(page, 1);
  const scene = await page.locator(".table-scene").boundingBox();
  await page.mouse.move(scene.x + scene.width - 10, scene.y + 100);
  await settled(page);
  assert.notEqual((await sceneState(page)).matrix, end.matrix);
  await page.mouse.move(0, 0);
  await settled(page);
  assert.equal((await sceneState(page)).matrix, end.matrix);
  await progress(page, 0);
  await page.getByRole("link", { name: "See how it works" }).click();
  await page.waitForFunction(() => {
    const y = document
      .querySelector("#how-it-works")
      .getBoundingClientRect().top;
    return y >= 90 && y <= 110;
  });
  checks.push(
    "Pointer response resets on exit; the experience link skips the scroll sequence with native anchor navigation.",
  );

  await page.locator('[data-step="share"]').click();
  for (const count of [2, 4, 3, 4, 2]) {
    const button = page.locator(`[data-guests="${count}"]`);
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator('[data-guests][aria-pressed="true"]').count(),
      1,
    );
    assert.equal(
      await page.locator("[data-share-people] > span").count(),
      count,
    );
    assert.equal(
      await page.locator("[data-share-equation]").textContent(),
      `120 MDL ÷ ${count} = ${120 / count} MDL each`,
    );
    await page.locator('[data-step="bill"]').click();
    assert.equal(
      await page.locator("[data-receipt-total]").textContent(),
      String(120 / count + 35),
    );
    await page.locator('[data-step="share"]').click();
  }
  for (const role of ["waiter", "manager", "guest"]) {
    const button = page.locator(`[data-role="${role}"]`);
    await button.focus();
    await page.keyboard.press("Space");
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator('[data-role][aria-pressed="true"]').count(),
      1,
    );
    assert.equal(
      await page.locator(".role-detail-label").textContent(),
      `Illustrative ${role} view`,
    );
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle,
      ),
      "solid",
    );
  }
  checks.push(
    "Keyboard-operated 2/3/4-person examples retain exact fictional totals in the receipt; all three role previews retain focus and a single pressed state.",
  );

  for (const viewport of [
    { width: 1120, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await progress(page, 1);
    const state = await sceneState(page);
    assert.ok(state.enabled);
    assert.ok(
      state.notes[0].left >= state.phone.right,
      "Minimum pinned width must keep cards clear",
    );
    await fits(page);
  }
  await page.setViewportSize({ width: 1440, height: 650 });
  await settled(page);
  assert.equal((await sceneState(page)).enabled, false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await progress(page, 0.5);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => !document.body.classList.contains("story-enabled"),
  );
  const reduced = await sceneState(page);
  assert.ok(reduced.notes.every((note) => note.opacity === 1));
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
    0,
  );
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  checks.push(
    "Responsive resizing and a live reduced-motion change remove pinning; reduced motion exposes every card with no running animations.",
  );

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await page.locator("[data-role=guest]").waitFor();
    assert.equal((await sceneState(page)).enabled, false);
    for (const note of await page.locator(".floating-note").all()) {
      await note.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (el) => getComputedStyle(el).opacity === "1",
        await note.elementHandle(),
      );
    }
    const state = await sceneState(page);
    assert.ok(state.notes[0].top > state.phone.bottom);
    for (let i = 1; i < state.notes.length; i++)
      assert.ok(state.notes[i].top > state.notes[i - 1].bottom);
    await fits(page);
    if (width === 390)
      await page
        .locator(".table-scene")
        .screenshot({ path: path.join(results, "motion-mobile-story.png") });
  }
  const touch = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await touch.newPage();
  watch(touchPage);
  await touchPage.goto(origin);
  await touchPage.locator("[data-role=guest]").waitFor();
  assert.equal((await sceneState(touchPage)).enabled, false);
  checks.push(
    "Phones and tablets use vertically stacked cards with ordinary scrolling; touch-only devices never enable the pinned story.",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const count of [2, 3, 4]) {
      await page.locator('[data-step="share"]').click();
      await page.locator(`[data-guests="${count}"]`).click();
      for (const role of ["guest", "waiter", "manager"]) {
        await page.locator(`[data-role="${role}"]`).click();
        await fits(page);
        const audit = await new AxeBuilder({ page }).analyze();
        audits.push({
          width,
          guests: count,
          role,
          violations: audit.violations,
          incomplete: audit.incomplete.map((rule) => ({
            id: rule.id,
            targets: rule.nodes.map((node) => node.target),
          })),
        });
      }
    }
  }
  await writeFile(
    path.join(results, "motion-accessibility.json"),
    JSON.stringify(audits, null, 2),
  );
  assert.equal(
    audits.reduce((total, audit) => total + audit.violations.length, 0),
    0,
    "See motion-accessibility.json for violations",
  );
  checks.push(
    "Eighteen additional accessibility scans cover every group-size and role combination at 320 and 1440 pixels with zero automated violations.",
  );

  const noJS = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const staticPage = await noJS.newPage();
  watch(staticPage);
  await staticPage.goto(origin);
  assert.equal((await sceneState(staticPage)).enabled, false);
  assert.ok(
    (await sceneState(staticPage)).notes.every((note) => note.opacity === 1),
  );
  assert.equal(
    await staticPage.locator("[data-enhancement]:visible").count(),
    0,
  );
  assert.equal(await staticPage.locator("#role-detail").isVisible(), true);
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
    "Static content remains complete without JavaScript; no script/CSP errors, external requests, cookies, browser storage or data submission occurred.",
  );
  const result = { status: "passed", browser: await browser.version(), checks };
  await writeFile(
    path.join(results, "motion-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
