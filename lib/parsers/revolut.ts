import Papa from "papaparse";
import { ParsedTransaction } from "./index";

export function parseRevolut(text: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: ",",
  });

  return result.data
    .map((row): ParsedTransaction | null => {
      // Only import completed transactions
      const estado = (row["Estado"] || row["State"] || "").trim().toUpperCase();
      if (estado !== "CONCLUÍDA" && estado !== "COMPLETED") return null;

      // Use settlement date (Data de Conclusão / Completed Date)
      const dateStr = (row["Data de Conclusão"] || row["Completed Date"] || row["Data de início"] || row["Started Date"] || "").trim().slice(0, 10);
      if (!dateStr) return null;
      const data = new Date(dateStr);
      if (isNaN(data.getTime())) return null;

      const descricao = (row["Descrição"] || row["Description"] || "Sem descrição").trim();
      const montante = parseFloat((row["Montante"] || row["Amount"] || "0").replace(",", ".")) || 0;

      if (montante === 0) return null;

      const tipo = (row["Tipo"] || row["Type"] || "").trim();

      if (montante < 0) {
        return { data, descricao, valor: Math.abs(montante), tipo: "DESPESA" };
      } else {
        // Positive: top-ups are transfers, everything else is income
        const isTopUp = tipo.toLowerCase().includes("carregamento") || tipo.toLowerCase().includes("top-up");
        return { data, descricao, valor: montante, tipo: isTopUp ? "RECEITA" : "RECEITA" };
      }
    })
    .filter(Boolean) as ParsedTransaction[];
}
