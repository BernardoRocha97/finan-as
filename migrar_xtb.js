/**
 * Migração XTB Excel → finances.db
 * Lê o ficheiro xtb.xlsx e popula Investment + InvestmentTransaction
 */
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");
const fs = require("fs");

const XTB_FILE = path.join("C:/Users/berna/OneDrive/Ambiente de Trabalho", "xtb.xlsx");
const DB_PATH = path.join(process.cwd(), "prisma", "finances.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${DB_PATH}` });
const prisma = new PrismaClient({ adapter });

// Excel serial date → JS Date
function excelDate(serial) {
  return new Date((serial - 25569) * 86400 * 1000);
}

// Parse "OPEN BUY 5 @ 54.01" → { qty: 5, price: 54.01 }
function parseBuy(comment) {
  const m = comment.match(/OPEN BUY\s+([\d.]+)\s*@\s*([\d.]+)/i);
  if (m) return { qty: parseFloat(m[1]), price: parseFloat(m[2]) };
  return null;
}

// Parse "CLOSE BUY 2/6 @ 130.56" or "CLOSE BUY 5 @ 65.67" → { qty, price }
function parseSell(comment) {
  const m = comment.match(/CLOSE BUY\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i);
  if (m) return { qty: parseFloat(m[1]), price: parseFloat(m[2]) };
  return null;
}

// Parse dividend per share "MCD.US USD 1.7700/ SHR"
function parseDivComment(comment) {
  const m = comment.match(/([\d.]+)\s*\/\s*SHR/i);
  return m ? parseFloat(m[1]) : null;
}

// Symbol display names
const SYM_NAMES = {
  "UVV.US": "Universal Corp (UVV)",
  "PEP.US": "PepsiCo (PEP)",
  "BMO.US": "Bank of Montreal (BMO)",
  "MCD.US": "McDonald's (MCD)",
  "JNJ.US": "Johnson & Johnson (JNJ)",
  "ADM.US": "Archer-Daniels-Midland (ADM)",
  "KO.US": "Coca-Cola (KO)",
  "SBUX.US": "Starbucks (SBUX)",
  "JEIP.DE": "JPM Equity Income ETF (JEIP)",
  "QYLD.UK": "Global X NASDAQ 100 Covered Call (QYLD)",
  "JEQP.DE": "JPM Equity Premium Income ETF (JEQP)",
  "BTI.US": "British American Tobacco (BTI)",
  "AGNC.US": "AGNC Investment (AGNC)",
  "STAG.US": "STAG Industrial (STAG)",
  "ENB.US": "Enbridge (ENB)",
  "O.US": "Realty Income (O)",
  "VGWD.DE": "Vanguard FTSE All-World High Div ETF (VGWD)",
  "SPCX.US": "The SPAC and New Issue ETF (SPCX)",
};

function symType(sym) {
  if (sym.endsWith(".DE") || sym === "QYLD.UK" || sym === "VGWD.DE") return "ETF";
  return "ACAO";
}

async function main() {
  const wb = XLSX.readFile(XTB_FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const data = rows.slice(11).filter((r) => r.length > 1 && r[1]);

  console.log(`Linhas a processar: ${data.length}`);

  // ── 1. Criar ativos por símbolo ──────────────────────────────
  const symbols = [...new Set(data.filter((r) => r[4]).map((r) => r[4]))];
  console.log(`Símbolos encontrados: ${symbols.join(", ")}`);

  const invMap = {};
  for (const sym of symbols) {
    const existing = await prisma.investment.findFirst({ where: { ticker: sym } });
    if (existing) {
      invMap[sym] = existing.id;
      console.log(`  Já existe: ${sym}`);
      continue;
    }
    const inv = await prisma.investment.create({
      data: {
        nome: SYM_NAMES[sym] ?? sym,
        ticker: sym,
        tipo: symType(sym),
        quantidade: 0,
        precoMedioCompra: 0,
        valorAtualUnidade: 0,
        plataforma: "XTB",
        ativa: true,
      },
    });
    invMap[sym] = inv.id;
    console.log(`  Criado: ${sym}`);
  }

  // ── 2. Juntar WHT ao dividendo respetivo ─────────────────────
  // Agrupar por (símbolo, tempo arredondado) para fazer net do WHT
  const whtMap = {}; // key = sym+"|"+timeRounded → valor negativo WHT
  for (const r of data) {
    if (r[1] === "Withholding Tax" && r[4]) {
      const key = `${r[4]}|${Math.round(r[2] * 1000)}`;
      whtMap[key] = (whtMap[key] ?? 0) + parseFloat(r[5] ?? 0);
    }
  }

  // ── 3. Processar cada linha ───────────────────────────────────
  let compras = 0, vendas = 0, dividendos = 0, skipped = 0;

  for (const r of data) {
    const [id, tipo, timeSerial, comment, sym, amountRaw] = r;
    const amount = parseFloat(amountRaw ?? 0);
    const data_tx = excelDate(timeSerial);

    if (tipo === "Stock purchase" && sym) {
      const parsed = parseBuy(comment ?? "");
      if (!parsed) { skipped++; continue; }
      await prisma.investmentTransaction.create({
        data: {
          investmentId: invMap[sym],
          tipo: "COMPRA",
          data: data_tx,
          quantidade: parsed.qty,
          preco: parsed.price,
          comissao: 0,
          notas: comment,
        },
      });
      compras++;
    } else if (tipo === "Stock sale" && sym) {
      const parsed = parseSell(comment ?? "");
      if (!parsed) { skipped++; continue; }
      await prisma.investmentTransaction.create({
        data: {
          investmentId: invMap[sym],
          tipo: "VENDA",
          data: data_tx,
          quantidade: parsed.qty,
          preco: parsed.price,
          comissao: 0,
          notas: comment,
        },
      });
      vendas++;
    } else if (tipo === "DIVIDENT" && sym) {
      // Net do WHT
      const key = `${sym}|${Math.round(timeSerial * 1000)}`;
      const wht = whtMap[key] ?? 0;
      const netDiv = amount + wht; // wht é negativo
      await prisma.investmentTransaction.create({
        data: {
          investmentId: invMap[sym],
          tipo: "DIVIDENDO",
          data: data_tx,
          valorDividendo: Math.max(0, Math.round(netDiv * 100) / 100),
          notas: comment,
        },
      });
      dividendos++;
    }
    // deposit, withdrawal, interest, tax → ignorar aqui
  }

  // ── 4. Recalcular quantidade e preço médio por ativo ─────────
  console.log("\nA recalcular quantidades e preços médios...");
  for (const sym of symbols) {
    const invId = invMap[sym];
    const ops = await prisma.investmentTransaction.findMany({
      where: { investmentId: invId, tipo: { in: ["COMPRA", "VENDA"] } },
      orderBy: { data: "asc" },
    });

    let qty = 0;
    let custoMedio = 0;
    for (const op of ops) {
      const q = parseFloat(op.quantidade ?? 0);
      const p = parseFloat(op.preco ?? 0);
      if (op.tipo === "COMPRA") {
        if (qty + q > 0) {
          custoMedio = (custoMedio * qty + p * q) / (qty + q);
        }
        qty += q;
      } else if (op.tipo === "VENDA") {
        qty = Math.max(0, qty - q);
      }
    }

    await prisma.investment.update({
      where: { id: invId },
      data: {
        quantidade: Math.round(qty * 10000) / 10000,
        precoMedioCompra: Math.round(custoMedio * 10000) / 10000,
      },
    });
    console.log(`  ${sym}: ${Math.round(qty * 100) / 100} unid. @ ${custoMedio.toFixed(4)}`);
  }

  console.log(`\n✅ Concluído:`);
  console.log(`   Compras: ${compras}`);
  console.log(`   Vendas:  ${vendas}`);
  console.log(`   Dividendos (líquidos de WHT): ${dividendos}`);
  console.log(`   Ignorados: ${skipped}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
