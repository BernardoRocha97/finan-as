import { prisma } from "./prisma";
import { removeAccents } from "./utils";

const KEYWORDS: Record<string, string[]> = {
  Habitação: ["renda", "condominio", "agua", "luz", "gas", "eletricidade", "edf", "endesa", "seguro habitacao"],
  Alimentação: ["pingo doce", "continente", "lidl", "aldi", "auchan", "mercadona", "minipreco", "jumbo", "el corte ingles"],
  Transportes: ["galp", " bp ", "repsol", "cepsa", "uber", "bolt", " cp ", "metro", "carris", "autoestrada", "via verde", "sixt", "hertz"],
  Saúde: ["farmacia", "clinica", "medico", "dentista", "hospital", "optica", "wells", "sns", "unilabs"],
  Lazer: ["netflix", "spotify", "cinema", "hbo", "disney", "amazon prime", "youtube premium", "apple one", "playstation", "xbox"],
  Restaurantes: ["restaurante", "cafe", "snack", "mcdonald", "kfc", "pizza", "sushi", "nando", "subway", "burger", "tasca"],
  Telecomunicações: ["nos ", "meo ", "vodafone", "nowo", "digi"],
  Viagens: ["ryanair", "tap", "easyjet", "wizz", "airbnb", "booking", "hotel", "hostel", "flixbus"],
  Receita: ["salario", "ordenado", "vencimento", "freelance", "reembolso"],
  Seguros: ["fidelidade", "ageas", "tranquilidade", "allianz", "axa", "zurich", "ocidental", "generali"],
  Educação: ["fnac", "udemy", "coursera", "escola", "universidade", "wook"],
};

export async function categorizeTransaction(descricao: string): Promise<string | null> {
  const normalized = removeAccents(descricao.toLowerCase());

  // Check user-defined rules first
  const rules = await prisma.categoryRule.findMany({ orderBy: { prioridade: "desc" } });
  for (const rule of rules) {
    if (normalized.includes(removeAccents(rule.padrao.toLowerCase()))) {
      return rule.categoryId;
    }
  }

  // Look up existing transactions with same description that already have a category
  const existing = await prisma.transaction.findFirst({
    where: { descricao, categoryId: { not: null } },
    select: { categoryId: true },
    orderBy: { data: "desc" },
  });
  if (existing?.categoryId && existing.categoryId !== "Outros") {
    return existing.categoryId;
  }

  // Check keyword dictionary
  for (const [catNome, keywords] of Object.entries(KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        return catNome;
      }
    }
  }

  return "Outros";
}

export async function learnRule(padrao: string, categoryId: string) {
  const existing = await prisma.categoryRule.findFirst({ where: { padrao } });
  if (existing) {
    await prisma.categoryRule.update({ where: { id: existing.id }, data: { categoryId } });
  } else {
    await prisma.categoryRule.create({ data: { padrao, categoryId, prioridade: 0 } });
  }
}
