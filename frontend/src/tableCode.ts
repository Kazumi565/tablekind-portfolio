/** Accept only this installation's signed table link or its short-lived join token. */
export function parseTableCode(value: string, origin: string): string {
  const raw = value.trim();
  if (!raw || raw.length > 2048) throw new Error("Scan a Tablekind table QR or paste its link.");
  let token = raw;
  if (/^(https?:\/\/|\/)/i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw, origin);
    } catch {
      throw new Error("This is not a valid Tablekind table link.");
    }
    const values = [...url.searchParams.entries()];
    if (
      url.origin !== origin ||
      url.username || url.password || url.hash ||
      !["/", "/guest"].includes(url.pathname) ||
      values.length !== 1 ||
      !["join", "table"].includes(values[0][0])
    ) throw new Error("Only table links from this Tablekind installation can be scanned.");
    token = values[0][1];
  }
  const temporary = /^[A-Za-z0-9_-]{43}$/;
  const printed = /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\.[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\.[A-Za-z0-9_-]{43}$/;
  if (!temporary.test(token) && !printed.test(token))
    throw new Error("This is not a Tablekind table QR. Ask staff for the current code.");
  return token;
}
