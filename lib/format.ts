const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(cents: number): string {
  return brl.format(cents / 100);
}

export function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export function formatMonth(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${months[Number(m) - 1] || ""}/${y}`;
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** Data local de hoje em YYYY-MM-DD (evita deslocamento UTC do toISOString). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Mês local atual em YYYY-MM. */
export function currentMonthISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

/** Desloca um mês YYYY-MM por `delta` meses. Ex.: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
