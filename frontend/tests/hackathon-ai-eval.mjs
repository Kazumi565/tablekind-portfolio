// Opt-in REAL, potentially billable calls. Never run without a separately approved budget.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

if (process.env.RUN_REAL_AI_EVAL !== "approved") {
  console.log(
    "No calls made. Real AI evaluation requires an approved budget and RUN_REAL_AI_EVAL=approved.",
  );
  process.exit(0);
}
const config = Object.fromEntries(
  readFileSync(resolve("../.env.hackathon"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const n = l.indexOf("=");
      return [l.slice(0, n), l.slice(n + 1)];
    }),
);
assert.equal(config.AI_CALLS_ENABLED, "true");
assert.ok(
  Number(config.AI_MAX_CALLS) >= 6,
  "Allow at least six total calls, accounting for earlier usage",
);
const base = config.HACKATHON_APP_URL;
const url = new URL(base);
assert.ok(
  ["localhost", "127.0.0.1"].includes(url.hostname),
  "Evaluate on an isolated local demo",
);
async function api(path, token, body) {
  const r = await fetch(base + "/api" + path, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(65000),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok)
    throw new Error(
      `Evaluation request failed (HTTP ${r.status}). No response body is logged.`,
    );
  return r.json();
}
const login = await api("/auth/login", null, {
  email: config.HACKATHON_STAFF_EMAIL,
  password: config.HACKATHON_STAFF_PASSWORD,
});
const scenario = await api("/demo/scenarios", login.accessToken, {});
const token = scenario.guests[0].accessToken;
const prefix = `/sessions/${scenario.sessionId}`;
const state = await api(prefix, token);
const cases = [
  [
    "representative dinner",
    "Mihai pays for the burger, Diego pays for the pasta, and everyone shares the starter equally.",
    "READY",
    "equal",
  ],
  [
    "relative weights",
    "Split the shared starter with Mihai paying twice as much as each of Diego and Ana. Leave other dishes unchanged.",
    "READY",
    "weighted",
  ],
  [
    "single recipient",
    "Ana pays for the shared starter. Leave all other dishes as they are.",
    "READY",
    "assigned",
  ],
  ["invented dish", "Diego pays for the lobster.", "CLARIFY"],
  [
    "unsupported refund",
    "Refund everyone's payments and convert the bill to dollars.",
    "CLARIFY",
  ],
  ["unclear referent", "Split that between those two people.", "CLARIFY"],
];
const results = [];
for (const [name, instruction, expected, check] of cases) {
  const start = performance.now();
  const p = await api(prefix + "/ai-splits/preview", token, {
    revision: state.session.revision,
    instruction,
  });
  let passed = p.status === expected;
  if (passed && check) {
    const starter = p.items?.find((i) => i.name === "Shared starter");
    const parts = starter?.shares ?? [];
    passed =
      starter?.totalMinor === 701 &&
      parts.reduce((n, s) => n + s.amountMinor, 0) === 701;
    if (check === "equal")
      passed &&=
        parts.length === 3 &&
        parts.every((s) => [233, 234].includes(s.amountMinor));
    if (check === "weighted")
      passed &&=
        parts.length === 3 &&
        parts.find((s) => s.name === "Mihai")?.amountMinor === 351;
    if (check === "assigned")
      passed &&=
        parts.length === 1 &&
        parts[0].name === "Ana" &&
        parts[0].amountMinor === 701;
  }
  results.push({
    name,
    expected,
    observed: p.status,
    passed,
    latencyMs: Math.round(performance.now() - start),
  });
}
const after = await api(prefix, token);
assert.equal(
  after.session.revision,
  state.session.revision,
  "Evaluation must never confirm proposals or settle payments",
);
const output = resolve("../test-results/hackathon-ai-eval");
mkdirSync(output, { recursive: true });
const result = {
  recordedAt: new Date().toISOString(),
  model: config.AI_MODEL,
  calls: cases.length,
  passed: results.every((r) => r.passed),
  results,
  cost: "Record actual provider usage separately",
  proposalsConfirmed: 0,
  payments: 0,
};
writeFileSync(resolve(output, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
