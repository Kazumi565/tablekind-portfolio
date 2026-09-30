import assert from "node:assert/strict";
import test from "node:test";
import { parseTableCode } from "../src/tableCode.ts";

const origin = "https://demo.tablekind.test";
const uuidA = "11111111-1111-4111-8111-111111111111";
const uuidB = "22222222-2222-4222-8222-222222222222";
const signature = "A".repeat(43);
const printed = `${uuidA}.${uuidB}.${signature}`;
const temporary = "z".repeat(43);

test("the current installation accepts signed-looking printed and temporary codes", () => {
  for (const token of [printed, temporary]) {
    assert.equal(parseTableCode(token, origin), token);
    assert.equal(parseTableCode(`${origin}/?join=${token}`, origin), token);
    assert.equal(parseTableCode(`${origin}/guest?table=${token}`, origin), token);
    assert.equal(parseTableCode(`/?join=${token}`, origin), token);
  }
});

test("other sites and credentials never become table joins", () => {
  for (const value of [
    `https://example.org/?join=${printed}`,
    `https://demo.tablekind.test.evil.test/?join=${printed}`,
    `https://attacker@demo.tablekind.test/?join=${printed}`,
    `http://demo.tablekind.test/?join=${printed}`,
    `//example.org/?join=${printed}`,
    `https://demo.tablekind.test/admin?join=${printed}`,
  ]) assert.throws(() => parseTableCode(value, origin));
});

test("malformed, extra-parameter and fragment links are rejected", () => {
  for (const value of [
    "", "example.org", "https://example.org/", "a".repeat(2049),
    `/?join=${printed}&redirect=https://example.org`,
    `/?join=${printed}&join=${temporary}`,
    `/?join=${printed}#part`,
    `/?guest=${printed}`,
    `/?join=${printed.slice(0, -1)}!`,
    `/?join=${printed.slice(0, -1)}`,
    "<script>alert(1)</script>",
  ]) assert.throws(() => parseTableCode(value, origin));
});

test("a fresh deployment URL is required; the old printed origin is not silently trusted", () => {
  assert.throws(() => parseTableCode(`${origin}/?join=${printed}`, "http://localhost:5180"));
});
