export type Area = "manage" | "staff" | "guest";

export function initialArea(path: string, query: string): Area {
  const params = new URLSearchParams(query);
  if (params.has("join") || params.has("table") || path.startsWith("/guest"))
    return "guest";
  if (path.startsWith("/staff")) return "staff";
  return "manage";
}

export function managesRestaurant(role?: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}
