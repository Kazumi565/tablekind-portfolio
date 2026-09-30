import assert from "node:assert/strict";
import test from "node:test";
import {
  PENDING_COMMAND_KEY,
  clearPending,
  keepPending,
  readPending,
  sameActor,
  savePending,
} from "../src/pendingCommand.ts";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const sid = "00000000-0000-0000-0000-000000000001";
const actorId = "00000000-0000-0000-0000-000000000002";
const op = {
  path: `/sessions/${sid}/payments`,
  method: "POST",
  body: {
    revision: 7,
    target: "SELF",
    guestIds: [],
    amountBani: 10001,
    method: "CARD",
    tipBani: 0,
  },
  key: "00000000-0000-0000-0000-000000000003",
  actorScope: `GUEST:${actorId}`,
};

test("reload preserves the original request identity and exact amount independently of later drafts", () => {
  const tab = storage();
  const draft = structuredClone(op);
  savePending(tab, draft);
  draft.body.revision = 99;
  draft.body.amountBani = 1;
  const recovered = readPending(tab);
  assert.equal(recovered.key, op.key);
  assert.deepEqual(recovered.body, op.body);
  assert.equal(recovered.actorScope, op.actorScope);
  assert.equal(recovered.path, op.path);
  assert.equal(recovered.method, op.method);
  clearPending(tab);
  assert.equal(readPending(tab), null);
});

test("join recovery stays anonymous even when the tab has a staff sign-in", () => {
  const tab = storage();
  savePending(tab, {
    ...op,
    actorScope: null,
    path: "/table-links/join",
    body: { token: "fixture-table-link", sessionId: sid, nickname: "Guest" },
  });
  const recovered = readPending(tab);
  assert(sameActor(recovered, null));
  assert(!sameActor(recovered, { kind: "STAFF", actorId }));
});

test("saved commands cannot be retried by a different guest or role", () => {
  assert(sameActor(op, { kind: "GUEST", actorId }));
  assert(!sameActor(op, { kind: "STAFF", actorId }));
  assert(!sameActor(op, { kind: "GUEST", actorId: sid }));
  assert(!sameActor(op, null));
});

test("staff creation retains retry identity without saving the initial password or bearer credentials", () => {
  const tab = storage();
  const password = "Temporary-fixture-password";
  savePending(tab, {
    ...op,
    actorScope: `STAFF:${actorId}`,
    path: `/restaurants/${sid}/staff`,
    body: { email: "fixture@example.test", password },
  });
  const recovered = readPending(tab);
  assert.equal(recovered.key, op.key);
  assert.equal(recovered.needsPassword, true);
  assert(!("password" in recovered.body));
  assert(!tab.getItem(PENDING_COMMAND_KEY).includes(password));
  assert.throws(() =>
    savePending(tab, { ...op, body: { nested: { accessToken: "fixture" } } }),
  );
  assert(!tab.getItem(PENDING_COMMAND_KEY).includes("accessToken"));
});

test("corrupt or invalid stored records block recovery without silently discarding the record", () => {
  const tab = storage();
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ ...op, key: "invalid" }),
    JSON.stringify({ ...op, path: "/auth/login" }),
  ]) {
    tab.setItem(PENDING_COMMAND_KEY, raw);
    assert.throws(() => readPending(tab));
    assert.equal(tab.getItem(PENDING_COMMAND_KEY), raw);
  }
});

test("storage failure is explicit before the caller may dispatch a command", () => {
  const tab = storage();
  tab.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => savePending(tab, op), /Cannot save this request/);
  assert.equal(readPending(tab), null);
});

test("uncertain and temporarily rejected retries keep their identity until a definite response", () => {
  for (const failure of [
    {},
    { status: 503 },
    { status: 401 },
    { status: 429 },
    { status: 408 },
    { status: 200, code: "INVALID_RESPONSE" },
  ])
    assert(keepPending(failure, op));
  for (const failure of [
    { status: 409, code: "STALE_REVISION" },
    { status: 400 },
    { status: 403 },
    { status: 503, code: "PAYMENTS_UNCONFIGURED" },
  ])
    assert(!keepPending(failure, op));
  assert(
    keepPending(
      { status: 409, code: "CONFLICT" },
      { ...op, needsPassword: true },
    ),
  );
});
