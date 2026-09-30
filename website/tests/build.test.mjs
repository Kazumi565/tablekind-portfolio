import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build, validateConfig, root } from "../scripts/build.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";

const empty = {
  siteUrl: "",
  contactEmail: "",
  operatorName: "",
  hostingProvider: "",
  hostingPrivacyUrl: "",
  enquiryRetentionDays: null,
  publicationReviewed: false,
};
const fixture = {
  siteUrl: "https://tablekind.fixture.org",
  contactEmail: "owner@tablekind.fixture.org",
  operatorName: "Fixture operator",
  hostingProvider: "Fixture host",
  hostingPrivacyUrl: "https://hosting.fixture.org/privacy",
  enquiryRetentionDays: 90,
  publicationReviewed: true,
};
async function output() {
  return path.join(
    await mkdtemp(path.join(tmpdir(), "tablekind-website-test-")),
    "dist",
  );
}
test("unconfigured release is rejected, while a preview is allowed", () => {
  assert.equal(validateConfig(empty).publicationReviewed, false);
  assert.throws(() => validateConfig(empty, true), /Configure/);
  assert.equal(
    validateConfig(fixture, true).contactEmail,
    fixture.contactEmail,
  );
});
test("only public configuration is accepted, with safe mailbox and HTTPS origins", () => {
  for (const config of [
    { ...fixture, apiKey: "not-allowed" },
    { ...fixture, contactEmail: "a@b.com\nBcc:other@b.com" },
    { ...fixture, siteUrl: "javascript:alert(1)" },
    { ...fixture, siteUrl: "https://user:password@tablekind.fixture.org" },
    { ...fixture, siteUrl: "https://tablekind.fixture.org/demo" },
    { ...fixture, siteUrl: "https://localhost" },
    { ...fixture, enquiryRetentionDays: 0 },
    { ...fixture, publicationReviewed: "true" },
  ])
    assert.throws(() => validateConfig(config, true));
});
test("release requires an explicit policy review and bounded retention", () => {
  assert.throws(
    () => validateConfig({ ...fixture, publicationReviewed: false }, true),
    /Review/,
  );
  assert.throws(
    () => validateConfig({ ...fixture, enquiryRetentionDays: null }, true),
    /Review/,
  );
});
test("build escapes owner fields and exposes only the contact mailbox to browser code", async () => {
  const dist = await output();
  await build({
    output: dist,
    config: {
      ...fixture,
      operatorName: '<script>alert("not markup")</script>',
    },
  });
  const html = await readFile(path.join(dist, "privacy.html"), "utf8");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>alert"));
  const config = await readFile(path.join(dist, "assets/config.js"), "utf8");
  assert.ok(config.includes(fixture.contactEmail));
  assert.ok(!config.includes("operatorName"));
});
test("release and preview robots, canonical URLs and CSP stay distinct", async () => {
  const dist = await output();
  await build({ output: dist, release: true, config: fixture });
  assert.match(
    await readFile(path.join(dist, "robots.txt"), "utf8"),
    /Allow: \//,
  );
  assert.match(
    await readFile(path.join(dist, "index.html"), "utf8"),
    /rel="canonical"/,
  );
  const romanian = await readFile(path.join(dist, "ro/index.html"), "utf8");
  assert.match(romanian, /<html lang="ro">/);
  assert.match(romanian, /hreflang="en"/);
  assert.match(romanian, /rel="canonical" href="https:\/\/tablekind.fixture.org\/ro\/"/);
  assert.match(await readFile(path.join(dist, "sitemap.xml"), "utf8"), /\/ro\/pilot.html/);
  assert.match(
    await readFile(path.join(dist, "_headers"), "utf8"),
    /connect-src 'none'/,
  );
  assert.doesNotMatch(
    await readFile(path.join(dist, "_headers"), "utf8"),
    /noindex/,
  );
  await build({ output: dist, config: empty });
  assert.match(
    await readFile(path.join(dist, "robots.txt"), "utf8"),
    /Disallow: \//,
  );
  assert.doesNotMatch(
    await readFile(path.join(dist, "index.html"), "utf8"),
    /rel="canonical"/,
  );
  assert.doesNotMatch(await readFile(path.join(dist, "ro/index.html"), "utf8"), /rel="canonical"/);
  assert.match(await readFile(path.join(dist, "_headers"), "utf8"), /noindex/);
  assert.doesNotMatch(
    await readFile(path.join(dist, "sitemap.xml"), "utf8"),
    /fixture.org/,
  );
});
test("unknown stale output stops the build and is not silently uploaded or deleted", async () => {
  const dist = await output();
  await mkdir(dist);
  await writeFile(path.join(dist, "private.txt"), "fixture");
  await assert.rejects(() => build({ output: dist }), /Unexpected output/);
  assert.equal(
    await readFile(path.join(dist, "private.txt"), "utf8"),
    "fixture",
  );
  await assert.rejects(() => build({ output: root }), /dedicated dist/);
});
test("every page has unique title, semantic main and no unresolved template tokens", async () => {
  const dist = await output();
  await build({ output: dist });
  const titles = new Set();
  for (const file of (await readdir(dist)).filter((f) => f.endsWith(".html"))) {
    const html = await readFile(path.join(dist, file), "utf8");
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<main id="main">/);
    assert.match(html, /<h1[ >]/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  }
  assert.equal(titles.size, 5);
  const romanianTitles = new Set();
  for (const file of (await readdir(path.join(dist, "ro"))).filter((f) => f.endsWith(".html"))) {
    const html = await readFile(path.join(dist, "ro", file), "utf8");
    assert.match(html, /<html lang="ro">/);
    assert.match(html, /<main id="main">/);
    assert.match(html, /Sari la conținut/);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
    romanianTitles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  }
  assert.equal(romanianTitles.size, 5);
});
test("preview serves only static assets, rejects POST and never proxies application paths", async () => {
  const dist = await output();
  await build({ output: dist });
  const server = await createPreviewServer({ directory: dist, port: 0 });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of [
      "/api/auth/login",
      "/admin",
      "/manage",
      "/guest",
      "/.env.demo",
      "/_headers",
      "/site.config.json",
      "/src/index.html",
      "/ro/api/auth/login",
      "/ro/.env.demo",
      "/%2e%2e%2fpackage.json",
    ])
      assert.equal((await fetch(origin + route)).status, 404, route);
    assert.equal(
      (
        await fetch(origin + "/contact.html", {
          method: "POST",
          body: "name=Fixture",
        })
      ).status,
      405,
    );
    const response = await fetch(origin + "/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("permissions-policy"), /camera=\(\)/);
    assert.match(
      response.headers.get("content-security-policy"),
      /form-action 'none'/,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
