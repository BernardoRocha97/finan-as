import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: pt });
}

export function formatMonth(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM yyyy", { locale: pt });
}

export function toNumber(val: unknown): number {
  return Number(val ?? 0);
}

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
