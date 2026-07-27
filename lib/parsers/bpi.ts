import Papa from "papaparse";
import { ParsedTransaction, parseDate, parseAmount } from "./index";

export function parseBPI(text: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
  });

  return result.data
    .map((row): ParsedTransaction | null => {
      const data = parseDate(row["Data Mov."] || row["Data"]);
      if (!data) return null;
      const descricao = row["Descrição"] || row["Descricao"] || "Sem descrição";
      const debito = parseAmount(row["Débito"] || row["Debito"] || "0");
      const credito = parseAmount(row["Crédito"] || row["Credito"] || "0");
      if (debito === 0 && credito === 0) return null;
      return debito > 0
        ? { data, descricao, valor: debito, tipo: "DESPESA" }
        : { data, descricao, valor: credito, tipo: "RECEITA" };
    })
    .filter(Boolean) as ParsedTransaction[];
}
