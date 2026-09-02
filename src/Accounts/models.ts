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
  "#3b5bdb",
  "#2f9e44",
  "#e8590c",
  "#e03131",
  "#d6336c",
  "#0c8599",
  "#7048e8",
  "#495057",
] as const;

/**
 * Escolhe fg (branco ou quase-preto) com contraste suficiente sobre a cor
 * arbitrária do usuário, usando luminância relativa (WCAG).
 */
export function foregroundOn(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? "#1a1a1a" : "#ffffff";
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
