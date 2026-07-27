import Papa from "papaparse";
import { ParsedTransaction, parseDate, parseAmount } from "./index";

export function parseGenericCSV(text: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: text.includes(";") ? ";" : ",",
  });

  return result.data
    .map((row): ParsedTransaction | null => {
      const keys = Object.keys(row).map((k) => k.toLowerCase().trim());
      const get = (candidates: string[]) => {
        for (const c of candidates) {
          const k = keys.find((k) => k.includes(c));
          if (k) return row[Object.keys(row)[keys.indexOf(k)]];
        }
        return "";
      };

      const dataStr = get(["data", "date"]);
      const data = parseDate(dataStr);
      if (!data) return null;

      const descricao = get(["descri", "description", "memo", "narration"]) || "Sem descrição";
      const debito = parseAmount(get(["debito", "debit", "saida"]));
      const credito = parseAmount(get(["credito", "credit", "entrada"]));
      const valorStr = get(["valor", "value", "amount", "montante"]);
      let valor = 0;
      let tipo: "DESPESA" | "RECEITA" = "DESPESA";

      if (debito > 0) {
        valor = debito;
        tipo = "DESPESA";
      } else if (credito > 0) {
        valor = credito;
        tipo = "RECEITA";
      } else if (valorStr) {
        const v = parseAmount(valorStr);
        valor = Math.abs(v);
        tipo = v < 0 ? "DESPESA" : "RECEITA";
      }

      if (valor === 0) return null;
      return { data, descricao, valor, tipo };
    })
    .filter(Boolean) as ParsedTransaction[];
}
