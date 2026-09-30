import assert from "node:assert/strict";

export async function section(page, name) {
  const nav = page.getByRole("navigation", { name: "Workspace sections" });
  const target = nav.getByRole("button", { name, exact: true });
  if (!(await target.isVisible()))
    await nav.locator(".workspace-more > summary").click();
  await target.click();
}

// Test inbox only. Do not point this helper at a live provider or print codes/messages.
export async function emailCode(recipient, purpose = "verify your email") {
  const base = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:8025";
  const url = new URL(base);
  assert(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Use the local Mailpit inbox only",
  );
  for (let i = 0; i < 45; i++) {
    const response = await fetch(
      `${base}/api/v1/search?query=${encodeURIComponent("to:" + recipient)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    assert(response.ok, "Mailpit search failed");
    const data = await response.json();
    const item = data.messages?.find((m) => m.Subject.includes(purpose));
    if (item) {
      const message = await fetch(`${base}/api/v1/message/${item.ID}`, {
        signal: AbortSignal.timeout(4000),
      }).then((r) => r.json());
      const code = message.Text?.match(/code: (\d{8})/);
      if (code) return code[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("No matching local test email arrived");
}
