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
  if (!ym) return "Selecione";
  const [y, m] = ym.split("-");
  return `${months[Number(m) - 1] || ""}/${y}`;
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}
