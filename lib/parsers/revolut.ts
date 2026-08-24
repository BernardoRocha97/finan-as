import Papa from "papaparse";
import { ParsedTransaction } from "./index";

export function parseRevolut(text: string): { transactions: ParsedTransaction[]; saldoFinal: number | null } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  let saldoFinal: number | null = null;

  const transactions = result.data
    .map((row): ParsedTransaction | null => {
      const estado = (row["Estado"] || row["State"] || "").trim().toUpperCase();
      if (estado !== "CONCLUÍDA" && estado !== "COMPLETED") return null;

      const dateStr = (row["Data de Conclusão"] || row["Completed Date"] || row["Data de início"] || row["Started Date"] || "").trim().slice(0, 10);
      if (!dateStr) return null;
      const data = new Date(dateStr);
      if (isNaN(data.getTime())) return null;

      const descricao = (row["Descrição"] || row["Description"] || "Sem descrição").trim();
      const montante = parseFloat((row["Montante"] || row["Amount"] || "0").replace(",", ".")) || 0;
      if (montante === 0) return null;

      // Track the last balance from the CSV
      const saldo = parseFloat((row["Saldo"] || row["Balance"] || "").replace(",", "."));
      if (!isNaN(saldo)) saldoFinal = saldo;

      const tipo = (row["Tipo"] || row["Type"] || "").trim();

      if (montante < 0) {
        return { data, descricao, valor: Math.abs(montante), tipo: "DESPESA" };
      } else {
        // Skip top-ups entirely — they are transfers from another account and would corrupt the balance
        const isTopUp = tipo.toLowerCase().includes("carregamento") || tipo.toLowerCase().includes("top-up") || tipo.toLowerCase().includes("topup");
        if (isTopUp) return null;
        return { data, descricao, valor: montante, tipo: "RECEITA" };
      }
    })
    .filter(Boolean) as ParsedTransaction[];

  return { transactions, saldoFinal };
}
