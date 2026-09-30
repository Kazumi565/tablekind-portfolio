/** One unresolved command per browser tab. Store it before any network dispatch. */
export const PENDING_COMMAND_KEY = "tablekind.pendingCommand.v1";

export type PendingCommand = {
  path: string;
  method: string;
  body: Record<string, unknown>;
  key: string;
  actorScope: string | null;
  needsPassword?: boolean;
};

type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const keyPattern = new RegExp(`^${uuid}$`, "i");
const actorPattern = new RegExp(`^(STAFF|GUEST):${uuid}$`, "i");
const staffCreation = new RegExp(`^/restaurants/${uuid}/staff$`, "i");
const credentials =
  /password|secret|access.?token|refresh.?token|authorization|recovery.?code|otp/i;

function containsCredentials(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => credentials.test(key) || containsCredentials(child),
  );
}

function validate(value: unknown): asserts value is PendingCommand {
  const op = value as PendingCommand | null;
  if (
    !op ||
    typeof op.path !== "string" ||
    !/^\/(restaurants|sessions|join|table-links\/join)(\/|$)/.test(op.path) ||
    !["POST", "PUT", "DELETE"].includes(op.method) ||
    typeof op.key !== "string" ||
    !keyPattern.test(op.key) ||
    !(
      op.actorScope === null ||
      (typeof op.actorScope === "string" && actorPattern.test(op.actorScope))
    ) ||
    !op.body ||
    typeof op.body !== "object" ||
    Array.isArray(op.body) ||
    containsCredentials(op.body) ||
    (op.needsPassword !== undefined && typeof op.needsPassword !== "boolean") ||
    (op.needsPassword &&
      !(op.method === "POST" && staffCreation.test(op.path))) ||
    (op.actorScope === null &&
      !["/join", "/table-links/join"].includes(op.path))
  )
    throw new Error(
      "Saved request details are invalid. Ask staff to check the last action before clearing this tab.",
    );
}

export function readPending(storage: TabStorage): PendingCommand | null {
  const raw = storage.getItem(PENDING_COMMAND_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "Saved request details could not be read. Ask staff to check the last action before clearing this tab.",
    );
  }
  validate(value);
  return value;
}

export function savePending(
  storage: TabStorage,
  op: PendingCommand,
): PendingCommand {
  // Staff creation is the only ordinary command containing a password. Keep the
  // original key and other fields, and ask for that password again on retry.
  const body = { ...op.body };
  let needsPassword = op.needsPassword === true;
  if (
    op.method === "POST" &&
    staffCreation.test(op.path) &&
    "password" in body
  ) {
    delete body.password;
    needsPassword = true;
  }
  const saved = {
    path: op.path,
    method: op.method,
    key: op.key,
    actorScope: op.actorScope,
    body,
    needsPassword,
  };
  validate(saved);
  const serialized = JSON.stringify(saved);
  try {
    storage.setItem(PENDING_COMMAND_KEY, serialized);
  } catch {
    throw new Error(
      "Cannot save this request for recovery. Enable storage for this tab before trying again.",
    );
  }
  return JSON.parse(serialized) as PendingCommand;
}

export function clearPending(storage: TabStorage): void {
  storage.removeItem(PENDING_COMMAND_KEY);
}

export function sameActor(
  op: PendingCommand,
  actor: { kind: string; actorId: string } | null,
): boolean {
  return op.actorScope === null
    ? actor === null
    : !!actor && op.actorScope === `${actor.kind}:${actor.actorId}`;
}

export function keepPending(
  error: { status?: number; code?: string },
  op: PendingCommand,
): boolean {
  return (
    error.status === undefined ||
    error.code === "INVALID_RESPONSE" ||
    error.status === 401 ||
    error.status === 408 ||
    error.status === 429 ||
    (op.needsPassword === true && error.code === "CONFLICT") ||
    (error.status >= 500 &&
      !["POS_UNAVAILABLE", "PAYMENTS_UNCONFIGURED"].includes(error.code ?? ""))
  );
}
