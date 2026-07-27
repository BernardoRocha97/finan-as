import Papa from "papaparse";
import { ParsedTransaction, parseDate, parseAmount } from "./index";

export function parseMillennium(text: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
  });

  return result.data
    .map((row): ParsedTransaction | null => {
      const data = parseDate(row["Data"] || "");
      if (!data) return null;
      const descricao = row["Descrição"] || row["Descricao"] || "Sem descrição";
      const valor = parseAmount(row["Valor"] || "0");
      if (valor === 0) return null;
      return {
        data,
        descricao,
        valor: Math.abs(valor),
        tipo: valor < 0 ? "DESPESA" : "RECEITA",
      };
    })
    .filter(Boolean) as ParsedTransaction[];
}
