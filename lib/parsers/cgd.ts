import Papa from "papaparse";
import { ParsedTransaction, parseDate, parseAmount } from "./index";

export function parseCGD(text: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
  });

  return result.data
    .map((row): ParsedTransaction | null => {
      const data = parseDate(row["Data de Movimento"] || row["Data Mov"] || row["Data"]);
      if (!data) return null;
      const descricao = row["Descrição"] || row["Descricao"] || "Sem descrição";
      const montante = parseAmount(row["Montante"] || "0");
      if (montante === 0) return null;
      return {
        data,
        descricao,
        valor: Math.abs(montante),
        tipo: montante < 0 ? "DESPESA" : "RECEITA",
      };
    })
    .filter(Boolean) as ParsedTransaction[];
}
