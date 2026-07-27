export interface ParsedTransaction {
  data: Date;
  descricao: string;
  valor: number;
  tipo: "DESPESA" | "RECEITA";
  referencia?: string;
}

export function parseDate(str: string): Date | null {
  // DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  const pt = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (pt) return new Date(Number(pt[3]), Number(pt[2]) - 1, Number(pt[1]));
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

export function parseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0;
}

export { parseBPI } from "./bpi";
export { parseCGD } from "./cgd";
export { parseMillennium } from "./millennium";
export { parseGenericCSV } from "./generic";
