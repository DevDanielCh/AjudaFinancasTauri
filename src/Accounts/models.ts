export interface AccountInfo {
  uuid: string;
  name: string;
  color: string;
  created_at: string;
  active: boolean;
}

export interface AccountInput {
  name?: string;
  color?: string;
}

export const ACCOUNT_COLORS = [
  "#5865f2",
  "#3ba55c",
  "#faa81a",
  "#ed4245",
  "#eb459e",
  "#00a8fc",
  "#9b59b6",
  "#64748b",
] as const;

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
