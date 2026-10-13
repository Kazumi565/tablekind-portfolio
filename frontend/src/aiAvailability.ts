export type AiAvailability =
  | "CHECKING"
  | "AVAILABLE"
  | "DISABLED"
  | "UNCONFIGURED"
  | "ALLOWANCE_REACHED"
  | "DINER_LIMIT_REACHED"
  | "DINNER_CLOSED"
  | "UNREACHABLE";

const serverStatuses = new Set<AiAvailability>([
  "AVAILABLE",
  "DISABLED",
  "UNCONFIGURED",
  "ALLOWANCE_REACHED",
  "DINER_LIMIT_REACHED",
]);

export function parseAiAvailability(value: unknown): AiAvailability {
  if (!value || typeof value !== "object") return "UNREACHABLE";
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" &&
    serverStatuses.has(status as AiAvailability)
    ? (status as AiAvailability)
    : "UNREACHABLE";
}

export async function checkAiAvailability(
  action: (path: string, body?: unknown, method?: string) => Promise<unknown>,
): Promise<AiAvailability> {
  try {
    return parseAiAvailability(
      await action("/ai-splits/status", undefined, "GET"),
    );
  } catch {
    return "UNREACHABLE";
  }
}

export const aiAvailabilityCopy: Record<
  AiAvailability,
  { title: string; description: string }
> = {
  CHECKING: {
    title: "Checking the split assistant…",
    description: "You can also share a dish using the manual split controls.",
  },
  AVAILABLE: {
    title: "The split assistant is ready",
    description:
      "Previewing interprets your words. Every amount still needs your review and the affected diners’ agreement.",
  },
  DISABLED: {
    title: "The split assistant is switched off",
    description:
      "You can still share or transfer dishes manually. The same diner agreement rules apply.",
  },
  UNCONFIGURED: {
    title: "The split assistant is not set up yet",
    description:
      "You can still share or transfer dishes manually. The same diner agreement rules apply.",
  },
  ALLOWANCE_REACHED: {
    title: "The split assistant’s demo allowance is used up",
    description:
      "New AI previews are paused. You can still confirm a saved preview or share dishes manually.",
  },
  DINER_LIMIT_REACHED: {
    title: "Your split assistant is taking a short break",
    description:
      "You’ve reached the request limit for this hour. Try again later, confirm a saved preview, or share dishes manually.",
  },
  DINNER_CLOSED: {
    title: "This dinner is no longer open",
    description:
      "Your bill is still available to review. New split previews and proposals are closed.",
  },
  UNREACHABLE: {
    title: "We couldn’t check the split assistant",
    description:
      "Check again before requesting a preview, or use the manual split controls.",
  },
};
