import assert from "node:assert/strict";
import test from "node:test";
import {
  aiAvailabilityCopy,
  checkAiAvailability,
  parseAiAvailability,
} from "../src/aiAvailability.ts";

test("availability checks use only the read endpoint and never request a preview", async () => {
  const calls = [];
  const status = await checkAiAvailability(async (...args) => {
    calls.push(args);
    return { status: "DISABLED" };
  });
  assert.equal(status, "DISABLED");
  assert.deepEqual(calls, [["/ai-splits/status", undefined, "GET"]]);
});

test("unknown, malformed, and unreachable status responses fail closed", async () => {
  for (const value of [
    null,
    undefined,
    "AVAILABLE",
    {},
    { status: true },
    { status: "READY" },
    { available: true },
  ]) {
    assert.equal(parseAiAvailability(value), "UNREACHABLE");
    assert.equal(await checkAiAvailability(async () => value), "UNREACHABLE");
  }
  assert.equal(
    await checkAiAvailability(async () => {
      throw new Error("network down");
    }),
    "UNREACHABLE",
  );
});

test("all authorized statuses have clear copy and unavailable states offer a manual path", () => {
  for (const status of [
    "AVAILABLE",
    "DISABLED",
    "UNCONFIGURED",
    "ALLOWANCE_REACHED",
    "DINER_LIMIT_REACHED",
  ]) {
    assert.equal(parseAiAvailability({ status }), status);
    assert.ok(aiAvailabilityCopy[status].title.length);
    assert.ok(aiAvailabilityCopy[status].description.length);
    if (status !== "AVAILABLE")
      assert.match(aiAvailabilityCopy[status].description, /manual/);
  }
  for (const status of ["CHECKING", "UNREACHABLE"]) {
    assert.ok(aiAvailabilityCopy[status].title.length);
    assert.match(aiAvailabilityCopy[status].description, /manual/);
  }
});

test("closed dinner guidance explains why new previews and proposals are unavailable", () => {
  assert.match(aiAvailabilityCopy.DINNER_CLOSED.title, /no longer open/);
  assert.match(
    aiAvailabilityCopy.DINNER_CLOSED.description,
    /previews and proposals are closed/,
  );
  assert.doesNotMatch(
    aiAvailabilityCopy.DINNER_CLOSED.description,
    /manual|ready/,
  );
  assert.equal(parseAiAvailability({ status: "DINNER_CLOSED" }), "UNREACHABLE");
});
