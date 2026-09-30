export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["Idempotency-Key"] = key ?? crypto.randomUUID();
  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "The server returned an unreadable response.",
    );
  }
  if (!response.ok) {
    const e = data as { code?: string; message?: string };
    throw new ApiError(
      response.status,
      e.code ?? "REQUEST_FAILED",
      e.message ?? "The request failed.",
    );
  }
  return data as T;
}

/** Uses an Authorization header, never a token in the event URL. */
export async function live(
  path: string,
  token: string,
  onChange: () => void,
  onStatus: (connected: boolean) => void,
  signal: AbortSignal,
) {
  let retry = 1000;
  while (!signal.aborted) {
    try {
      const response = await fetch(`/api${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal,
      });
      if (!response.ok || !response.body)
        throw new Error("Live connection unavailable");
      onStatus(true);
      retry = 1000;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (event.includes("event:changed")) onChange();
        }
      }
    } catch {
      if (signal.aborted) break;
    }
    onStatus(false);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, retry);
      function done() {
        signal.removeEventListener("abort", done);
        clearTimeout(timer);
        resolve();
      }
      signal.addEventListener("abort", done, { once: true });
    });
    retry = Math.min(retry * 2, 10000);
  }
  onStatus(false);
}
export function bani(input: string): number {
  input = input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(input.trim()))
    throw new Error("Enter an amount with at most two decimal places.");
  const negative = input.startsWith("-"),
    [whole, decimal = ""] = input.replace("-", "").split(".");
  const value = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value > 1_000_000_000)
    throw new Error("Amount is too large.");
  return negative ? -value : value;
}
export const money = (n: number) => `${(n / 100).toFixed(2)} MDL`;
