import * as XLSX from "xlsx";
import { ParsedTransaction, parseDate, parseAmount } from "./index";

export interface ParsedXLSResult {
  transactions: ParsedTransaction[];
  saldoFinal: number | null;
}

export function parseCGDXLS(buffer: ArrayBuffer): ParsedXLSResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const headerIdx = rows.findIndex((r) => r && String(r[0]).includes("Data"));
  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r[0]);

  const transactions = dataRows
    .map((row): ParsedTransaction | null => {
      let dateStr = String(row[0] ?? "").trim();
      if (/^\d{5}$/.test(dateStr)) {
        const d = XLSX.SSF.parse_date_code(Number(dateStr));
        if (d) dateStr = `${String(d.d).padStart(2, "0")}-${String(d.m).padStart(2, "0")}-${d.y}`;
      }
      const data = parseDate(dateStr);
      if (!data) return null;
      const descricao = String(row[2] ?? "").trim() || "Sem descrição";
      // Values come as JS numbers from XLSX — use directly to avoid parseAmount
      // treating the decimal dot as a thousand separator
      const raw = row[3];
      const montante = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0").replace(",", "."));
      if (!montante || isNaN(montante)) return null;
      return {
        data,
        descricao,
        valor: Math.abs(montante),
        tipo: montante < 0 ? "DESPESA" : "RECEITA",
      };
    })
    .filter(Boolean) as ParsedTransaction[];

  // File is sorted newest-first, so first row's saldo = current account balance
  const firstRow = dataRows[0];
  const rawSaldo = firstRow?.[4];
  const saldoFinal = typeof rawSaldo === "number" ? rawSaldo : (parseFloat(String(rawSaldo ?? "").replace(",", ".")) || null);

  return { transactions, saldoFinal };
}
