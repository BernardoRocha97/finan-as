import nodemailer from "nodemailer";
import { gerarRelatorio, formatCur } from "./relatorio";

function criarHtml(r: Awaited<ReturnType<typeof gerarRelatorio>>) {
  const mes = r.data.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const datahora = r.data.toLocaleString("pt-PT");

  const contasRows = r.contas
    .map((c) => {
      const saldo = Number(c.saldo);
      const cor = saldo >= 0 ? "#16a34a" : "#dc2626";
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${c.nome}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${c.banco}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${cor}">${formatCur(saldo)}</td>
      </tr>`;
    })
    .join("");

  const catRows = r.topCategorias
    .map(([nome, val]) => `<tr>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6">${nome}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#dc2626">${formatCur(val)}</td>
      </tr>`)
    .join("");

  const ultimasRows = r.ultimas
    .map((t) => {
      const cor = t.tipo === "RECEITA" ? "#16a34a" : "#dc2626";
      const sinal = t.tipo === "RECEITA" ? "+" : "-";
      return `<tr>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px">${new Date(t.data).toLocaleDateString("pt-PT")}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:13px">${t.descricao}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${t.category?.nome ?? "—"}</td>
        <td style="padding:5px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${cor}">${sinal}${formatCur(Number(t.valor))}</td>
      </tr>`;
    })
    .join("");

  const saldoMesCor = r.saldo >= 0 ? "#16a34a" : "#dc2626";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">

    <!-- Cabeçalho -->
    <div style="background:#1e40af;padding:24px 28px;color:#fff">
      <h1 style="margin:0;font-size:22px">💰 Relatório Financeiro</h1>
      <p style="margin:4px 0 0;opacity:.8;font-size:14px">${datahora}</p>
    </div>

    <!-- Resumo do mês -->
    <div style="padding:20px 28px;background:#eff6ff;border-bottom:1px solid #dbeafe">
      <h2 style="margin:0 0 12px;font-size:15px;color:#1e40af;text-transform:uppercase;letter-spacing:.5px">Resumo de ${mes}</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px 16px;text-align:center">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Receitas</div>
          <div style="font-size:18px;font-weight:700;color:#16a34a">${formatCur(r.receitas)}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px 16px;text-align:center">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Despesas</div>
          <div style="font-size:18px;font-weight:700;color:#dc2626">${formatCur(r.despesas)}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px 16px;text-align:center">
          <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Saldo do mês</div>
          <div style="font-size:18px;font-weight:700;color:${saldoMesCor}">${formatCur(r.saldo)}</div>
        </div>
      </div>
    </div>

    <div style="padding:20px 28px">

      <!-- Total geral -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:15px;color:#15803d;font-weight:600">Patrimônio total</span>
        <span style="font-size:22px;font-weight:700;color:#15803d">${formatCur(r.totalSaldo)}</span>
      </div>

      <!-- Contas -->
      <h3 style="margin:0 0 8px;font-size:14px;color:#374151">Contas bancárias</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:500">Nome</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:500">Banco</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:500">Saldo</th>
          </tr>
        </thead>
        <tbody>${contasRows}</tbody>
      </table>

      <!-- Top categorias -->
      ${topCategorias(catRows, r.topCategorias.length)}

      <!-- Sem categoria -->
      ${r.semCategoria > 0 ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:20px">
        <span style="color:#c2410c;font-weight:600">⚠️ ${r.semCategoria} transação(ões) sem categoria</span>
        <span style="color:#9a3412;font-size:13px"> — abre a app para categorizar</span>
      </div>` : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px">
        <span style="color:#16a34a;font-weight:600">✅ Todas as transações estão categorizadas</span>
      </div>`}

      <!-- Últimas transações -->
      <h3 style="margin:0 0 8px;font-size:14px;color:#374151">Últimas transações do mês (${r.totalTransacoes} no total)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:500">Data</th>
            <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:500">Descrição</th>
            <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:500">Categoria</th>
            <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:500">Valor</th>
          </tr>
        </thead>
        <tbody>${ultimasRows}</tbody>
      </table>
    </div>

    <div style="padding:16px 28px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
      Relatório automático das Finanças Pessoais · ${datahora}
    </div>
  </div>
</body>
</html>`;
}

function topCategorias(rows: string, count: number) {
  if (!count) return "";
  return `<h3 style="margin:0 0 8px;font-size:14px;color:#374151">Top despesas por categoria</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
    <thead>
      <tr style="background:#f9fafb">
        <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:500">Categoria</th>
        <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:500">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export async function enviarRelatorio() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  const destinatario = process.env.REPORT_EMAIL ?? gmailUser;

  if (!gmailUser || !gmailPass) {
    console.log("[relatório] GMAIL_USER ou GMAIL_APP_PASSWORD não configurados — a saltar envio.");
    return;
  }

  const r = await gerarRelatorio();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `"Finanças Pessoais" <${gmailUser}>`,
    to: destinatario,
    subject: `💰 Relatório Financeiro — ${r.data.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}`,
    html: criarHtml(r),
  });

  console.log(`[relatório] Email enviado para ${destinatario}`);
}
