export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// Cash Operations columns (row index 4 = headers, row 5+ = data):
// 0=Type, 1=Instrument, 2=Ticker, 3=Category, 4=Time, 5=Amount, 6=ID, 7=Comment, 8=Product, 9=Position ID

function parseDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val === "number") return new Date((val - 25569) * 86400 * 1000);
  const s = String(val).replace(" ", "T").replace(/\..*$/, "");
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseBuyComment(comment: string): { qty: number; price: number } | null {
  // "OPEN BUY 6/6.2891 @ 79.640" or "OPEN BUY 0.2891/6.2891 @ 79.630"
  const m = comment.match(/OPEN BUY\s+([\d.]+)(?:\/([\d.]+))?\s*@\s*([\d.]+)/i);
  if (!m) return null;
  return { qty: parseFloat(m[1]), price: parseFloat(m[3]) };
}

function parseSellComment(comment: string): { qty: number; price: number } | null {
  const m = comment.match(/CLOSE BUY\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i);
  if (!m) return null;
  return { qty: parseFloat(m[1]), price: parseFloat(m[3]) };
}

const SYM_NAMES: Record<string, string> = {
  "UVV.US": "Universal Corp",
  "PEP.US": "PepsiCo",
  "BMO.US": "Bank of Montreal",
  "MCD.US": "McDonald's",
  "JNJ.US": "Johnson & Johnson",
  "ADM.US": "Archer-Daniels-Midland",
  "KO.US": "Coca-Cola",
  "SBUX.US": "Starbucks",
  "JEIP.DE": "US Equity Premium Income Active",
  "QYLD.UK": "NASDAQ 100 Covered Call",
  "JEQP.DE": "Nasdaq Equity Premium Income Active",
  "BTI.US": "British American Tobacco",
  "AGNC.US": "AGNC Investment",
  "STAG.US": "STAG Industrial",
  "ENB.US": "Enbridge",
  "O.US": "Realty Income",
  "VGWD.DE": "FTSE All-World High Dividend Yield",
  "SPCX.US": "The SPAC and New Issue ETF",
};

function symType(sym: string): string {
  if (sym.endsWith(".DE") || sym.endsWith(".UK")) return "ETF";
  return "ACAO";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Ficheiro não enviado" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

    // Find the Cash Operations sheet
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("cash")) ?? wb.SheetNames[1] ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

    // Find header row (contains "Type")
    const headerIdx = allRows.findIndex((r) => r[0] === "Type");
    if (headerIdx === -1) return NextResponse.json({ error: "Formato do ficheiro não reconhecido. Certifica que exportas o relatório XTB completo." }, { status: 400 });

    const data = allRows.slice(headerIdx + 1).filter((r) => r.length > 1 && r[0]);

    // Build WHT map: positionId -> wht amount (negative values)
    const whtMap: Record<string, number> = {};
    for (const r of data) {
      const [type, , , , , amount, , , , posId] = r;
      if (String(type).toLowerCase().includes("withholding") && posId) {
        whtMap[String(posId)] = (whtMap[String(posId)] ?? 0) + parseFloat(amount ?? 0);
      }
    }

    // Collect unique tickers (exclude deposits and withholding tax)
    const symbols = [...new Set(
      data
        .filter((r) => r[2] && !String(r[0]).toLowerCase().includes("withholding") && !String(r[0]).toLowerCase().includes("deposit"))
        .map((r) => String(r[2]))
    )];

    // Ensure Investment records exist
    const invMap: Record<string, string> = {};
    for (const sym of symbols) {
      const existing = await prisma.investment.findFirst({ where: { ticker: sym } });
      if (existing) {
        invMap[sym] = existing.id;
        // Update name from file if we have instrument name
        const row = data.find((r) => r[2] === sym && r[1]);
        if (row?.[1] && !existing.nome.includes(sym)) {
          // keep existing name
        }
      } else {
        const row = data.find((r) => r[2] === sym && r[1]);
        const nome = row?.[1] ? String(row[1]) : (SYM_NAMES[sym] ?? sym);
        const inv = await prisma.investment.create({
          data: {
            nome,
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
      }
    }

    let compras = 0, vendas = 0, dividendos = 0, duplicados = 0, erros = 0;

    for (const r of data) {
      const [typeRaw, instrument, sym, , timeVal, amountRaw, id, comment, , posId] = r;
      const type = String(typeRaw ?? "").toLowerCase().trim();
      if (!type || !id) continue;
      if (type.includes("withholding") || type.includes("deposit")) continue;
      if (!sym || !invMap[sym]) continue;

      const amount = parseFloat(amountRaw ?? 0);
      const dataTx = parseDate(timeVal);
      const commentStr = String(comment ?? "");
      const invId = invMap[sym];

      try {
        if (type.includes("stock purchase") || type.includes("buy")) {
          const parsed = parseBuyComment(commentStr);
          if (!parsed) continue;
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invId, notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invId,
              tipo: "COMPRA",
              data: dataTx,
              quantidade: parsed.qty,
              preco: parsed.price,
              comissao: 0,
              notas: `[XTB:${id}] ${commentStr}`.trim(),
            },
          });
          compras++;

        } else if (type.includes("stock sale") || type.includes("sell")) {
          const parsed = parseSellComment(commentStr);
          if (!parsed) continue;
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invId, notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invId,
              tipo: "VENDA",
              data: dataTx,
              quantidade: parsed.qty,
              preco: parsed.price,
              comissao: 0,
              notas: `[XTB:${id}] ${commentStr}`.trim(),
            },
          });
          vendas++;

        } else if (type.includes("dividend")) {
          const wht = posId ? (whtMap[String(posId)] ?? 0) : 0;
          const grossDiv = amount; // positive value
          const netDiv = Math.max(0, Math.round((grossDiv + wht) * 100) / 100); // wht is negative
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invId, notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invId,
              tipo: "DIVIDENDO",
              data: dataTx,
              valorDividendo: netDiv,
              notas: `[XTB:${id}] ${commentStr} (WHT: ${wht.toFixed(2)}€)`.trim(),
            },
          });
          dividendos++;
        }
      } catch {
        erros++;
      }
    }

    // Recalculate quantities and average prices for each symbol
    for (const sym of symbols) {
      const invId = invMap[sym];
      const ops = await prisma.investmentTransaction.findMany({
        where: { investmentId: invId, tipo: { in: ["COMPRA", "VENDA"] } },
        orderBy: { data: "asc" },
      });
      let qty = 0, custoMedio = 0;
      for (const op of ops) {
        const q = toNumber(op.quantidade);
        const p = toNumber(op.preco);
        if (op.tipo === "COMPRA") {
          if (qty + q > 0) custoMedio = (custoMedio * qty + p * q) / (qty + q);
          qty += q;
        } else {
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
    }

    return NextResponse.json({
      data: {
        compras,
        vendas,
        dividendos,
        duplicados,
        erros,
        simbolos: symbols.length,
        total: compras + vendas + dividendos,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
