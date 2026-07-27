import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "prisma", "finances.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  await prisma.preference.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const cats = [
    { nome: "Habitação", cor: "#ef4444", icone: "home", tipo: "DESPESA" },
    { nome: "Alimentação", cor: "#f97316", icone: "shopping-cart", tipo: "DESPESA" },
    { nome: "Transportes", cor: "#eab308", icone: "car", tipo: "DESPESA" },
    { nome: "Saúde", cor: "#22c55e", icone: "heart-pulse", tipo: "DESPESA" },
    { nome: "Lazer", cor: "#06b6d4", icone: "gamepad-2", tipo: "DESPESA" },
    { nome: "Educação", cor: "#6366f1", icone: "book-open", tipo: "DESPESA" },
    { nome: "Vestuário", cor: "#ec4899", icone: "shirt", tipo: "DESPESA" },
    { nome: "Seguros", cor: "#8b5cf6", icone: "shield", tipo: "DESPESA" },
    { nome: "Telecomunicações", cor: "#0ea5e9", icone: "wifi", tipo: "DESPESA" },
    { nome: "Restaurantes", cor: "#f59e0b", icone: "utensils", tipo: "DESPESA" },
    { nome: "Viagens", cor: "#14b8a6", icone: "plane", tipo: "DESPESA" },
    { nome: "Receita", cor: "#10b981", icone: "trending-up", tipo: "RECEITA" },
    { nome: "Dividendos", cor: "#059669", icone: "percent", tipo: "RECEITA" },
    { nome: "Poupança", cor: "#3b82f6", icone: "piggy-bank", tipo: "AMBOS" },
    { nome: "Outros", cor: "#6b7280", icone: "ellipsis", tipo: "AMBOS" },
  ];

  for (const cat of cats) {
    await prisma.category.upsert({
      where: { id: cat.nome },
      update: {},
      create: { id: cat.nome, ...cat },
    });
  }

  await prisma.account.upsert({
    where: { id: "conta-exemplo" },
    update: {},
    create: {
      id: "conta-exemplo",
      nome: "Conta Principal",
      tipo: "CORRENTE",
      saldo: 2500,
      banco: "CGD",
      cor: "#3b82f6",
    },
  });

  await prisma.investment.upsert({
    where: { id: "inv-vwce" },
    update: {},
    create: {
      id: "inv-vwce",
      nome: "Vanguard FTSE All-World",
      ticker: "VWCE",
      tipo: "ETF",
      quantidade: 10,
      precoMedioCompra: 105,
      valorAtualUnidade: 118,
      plataforma: "DEGIRO",
    },
  });

  await prisma.goal.upsert({
    where: { id: "goal-emergencia" },
    update: {},
    create: {
      id: "goal-emergencia",
      nome: "Fundo de Emergência",
      tipo: "POUPANCA",
      valorAlvo: 10000,
      valorAtual: 2500,
      icone: "shield",
      cor: "#10b981",
    },
  });

  await prisma.goal.upsert({
    where: { id: "goal-alimentacao" },
    update: {},
    create: {
      id: "goal-alimentacao",
      nome: "Orçamento Alimentação",
      tipo: "ORCAMENTO_MENSAL",
      valorAlvo: 300,
      valorAtual: 0,
      categoryId: "Alimentação",
      icone: "shopping-cart",
      cor: "#f97316",
    },
  });

  console.log("Seed concluído.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
