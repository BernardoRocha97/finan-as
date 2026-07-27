"""
Migração de minhas_financas.db → finances.db
"""
import sqlite3
import uuid
from datetime import datetime, date

SRC = r"Z:\Nova pasta\Softwares\Fiananças\minhas_financas.db"
DST = r"C:\Users\berna\OneDrive\Ambiente de Trabalho\financas\prisma\finances.db"

src = sqlite3.connect(SRC)
dst = sqlite3.connect(DST)
src.row_factory = sqlite3.Row

def uid(): return str(uuid.uuid4())

def parse_date(s):
    if not s: return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try: return datetime.strptime(s.strip(), fmt).strftime("%Y-%m-%d %H:%M:%S.000")
        except: pass
    return None

# ── Mapeamento de categorias ─────────────────────────────────────────────────
# Categorias na base antiga → IDs na nova (usamos o nome como ID no seed)
CAT_MAP = {
    "Supermercado":    "Alimentação",
    "Restaurantes":    "Restaurantes",
    "Renda":           "Habitação",
    "Casa":            "Habitação",
    "Carro":           "Transportes",
    "Transporte":      "Transportes",
    "Farmacia":        "Saúde",
    "Saúde":           "Saúde",
    "Saúde":       "Saúde",
    "Lazer":           "Lazer",
    "Ginasio":         "Lazer",
    "Faculdade":       "Educação",
    "Roupa":           "Vestuário",
    "Telemovel":       "Telecomunicações",
    "Subscrição": "Lazer",
    "Subscricao":      "Lazer",
    "Banco":           "Outros",
    "Barbeiro":        "Saúde",
    "MbWay":           "Outros",
    "Ordenado":        "Receita",
    "salario duplo":   "Receita",
    "ordem":           "Receita",
    "casamento":       "Outros",
    "Sem categoria":   "Outros",
    "Outros":          "Outros",
}

def map_cat(cat):
    if not cat: return "Outros"
    c = cat.strip()
    return CAT_MAP.get(c, CAT_MAP.get(c.encode('latin1').decode('utf8', errors='replace'), "Outros"))

# ── 1. Contas ────────────────────────────────────────────────────────────────
print("A migrar contas...")
contas_src = src.execute("SELECT * FROM saldos_contas").fetchall()

CONTA_IDS = {}
CONTA_CORES = {"XTB": "#8b5cf6", "Santander": "#ef4444", "Caixa": "#10b981"}

for c in contas_src:
    nome = c["conta"]
    existing = dst.execute("SELECT id FROM Account WHERE nome=?", (nome,)).fetchone()
    if existing:
        cid = existing[0]
    else:
        cid = uid()
        dst.execute("""
            INSERT INTO Account (id, nome, tipo, saldo, banco, cor, ativa, criadoEm, atualizadoEm)
            VALUES (?, ?, 'CORRENTE', ?, ?, ?, 1, datetime('now'), datetime('now'))
        """, (cid, nome, c["saldo_atual"], nome, CONTA_CORES.get(nome, "#3b82f6")))
    CONTA_IDS[nome] = cid

dst.commit()
print(f"  {len(contas_src)} contas migradas.")

# ── 2. Transações ────────────────────────────────────────────────────────────
print("A migrar transações...")
transacoes = src.execute("SELECT * FROM transacoes ORDER BY id").fetchall()

# Conta padrão para transações sem origem conhecida
default_conta = CONTA_IDS.get("Santander") or list(CONTA_IDS.values())[0]

def get_conta_id(origem):
    if not origem: return default_conta
    o = origem.strip()
    for nome, cid in CONTA_IDS.items():
        if nome.lower() in o.lower():
            return cid
    return default_conta

migradas = 0
erros = 0
for t in transacoes:
    try:
        data = parse_date(str(t["data"]))
        if not data:
            erros += 1
            continue

        valor = float(t["valor"] or 0)
        if valor == 0:
            continue

        tipo = "RECEITA" if valor > 0 else "DESPESA"
        cat_id = map_cat(t["categoria"])
        account_id = get_conta_id(t["origem_ficheiro"])
        descricao = (t["descricao"] or "Sem descrição").encode('latin1', errors='replace').decode('utf8', errors='replace')
        tid = uid()

        # Check duplicate
        dup = dst.execute("""
            SELECT id FROM "Transaction"
            WHERE data=? AND accountId=? AND ABS(valor - ?)< 0.01 AND descricao=?
        """, (data, account_id, abs(valor), descricao)).fetchone()
        if dup:
            continue

        dst.execute("""
            INSERT INTO "Transaction" (id, data, descricao, valor, tipo, categoryId, accountId,
                importada, revisada, criadoEm, atualizadoEm)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))
        """, (tid, data, descricao, abs(valor), tipo, cat_id, account_id))
        migradas += 1
    except Exception as e:
        erros += 1

dst.commit()
print(f"  {migradas} transações migradas, {erros} erros.")

# ── 3. Recalcular saldos das contas ─────────────────────────────────────────
print("A recalcular saldos...")
for nome, cid in CONTA_IDS.items():
    rows = dst.execute("""
        SELECT tipo, valor FROM "Transaction" WHERE accountId=? AND tipo != 'TRANSFERENCIA'
    """, (cid,)).fetchall()
    saldo = sum(r[1] if r[0]=="RECEITA" else -r[1] for r in rows)
    # Use real saldo from source if available
    src_saldo = src.execute("SELECT saldo_atual FROM saldos_contas WHERE conta=?", (nome,)).fetchone()
    if src_saldo:
        saldo = src_saldo[0]
    dst.execute("UPDATE Account SET saldo=? WHERE id=?", (saldo, cid))

dst.commit()

# ── 4. Imóvel e hipoteca ─────────────────────────────────────────────────────
print("A migrar imóvel e crédito habitação...")
patrimonio = src.execute("SELECT * FROM patrimonio").fetchone()
if patrimonio:
    nome_imovel = patrimonio["nome"].encode('latin1', errors='replace').decode('utf8', errors='replace')
    prop_id = uid()

    # Último registo de crédito para saber capital em dívida
    ultimo_ch = src.execute("SELECT * FROM credito_habitacao ORDER BY id DESC LIMIT 1").fetchone()
    capital_divida = float(ultimo_ch["saldo_devedor"]) if ultimo_ch else 0.0

    dst.execute("""
        INSERT OR IGNORE INTO Property (id, nome, valorEstimado, valorCompra, dataCompra, cor, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, ?, ?, '#f59e0b', datetime('now'), datetime('now'))
    """, (prop_id, nome_imovel, float(patrimonio["valor_ativo"]), float(patrimonio["valor_ativo"]), "2021-12-03 00:00:00.000"))

    if capital_divida > 0:
        mort_id = uid()
        first_ch = src.execute("SELECT * FROM credito_habitacao ORDER BY id ASC LIMIT 1").fetchone()
        valor_inicial = float(src.execute("SELECT MAX(saldo_devedor) FROM credito_habitacao").fetchone()[0] or 0)

        dst.execute("""
            INSERT OR IGNORE INTO Mortgage (id, propertyId, banco, valorInicial, capitalEmDivida,
                taxaJuro, tipoTaxa, spread, prestacaoMensal, dataInicio, prazoAnos, criadoEm, atualizadoEm)
            VALUES (?, ?, 'CGD', ?, ?, 3.5, 'VARIAVEL_EURIBOR', 1.5, 472.0, ?, 30, datetime('now'), datetime('now'))
        """, (mort_id, prop_id, valor_inicial, capital_divida,
              parse_date(str(first_ch["data"])) if first_ch else "2022-01-03 00:00:00.000"))

        # Migrar prestações
        ch_rows = src.execute("SELECT * FROM credito_habitacao ORDER BY id").fetchall()
        for ch in ch_rows:
            data_ch = parse_date(str(ch["data"]))
            if not data_ch: continue
            pid = uid()
            dst.execute("""
                INSERT INTO MortgagePayment (id, mortgageId, data, valorPago, capitalAmortizado, juros, criadoEm)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (pid, mort_id, data_ch, float(ch["total_pago"]), float(ch["amortizacao"]), float(ch["juros"])))

    dst.commit()
    print(f"  Imóvel '{nome_imovel}' migrado com {len(ch_rows) if capital_divida > 0 else 0} prestações.")

# ── 5. Investimentos XTB ─────────────────────────────────────────────────────
print("A migrar histórico XTB...")
xtb_rows = src.execute("SELECT * FROM historico_xtb ORDER BY data").fetchall()

# Agrupar por símbolo para criar ativos
simbolos = {}
for x in xtb_rows:
    s = x["tipo"] if x["tipo"] else "DEPOSITO"
    if x["simbolo"] and x["simbolo"] not in simbolos:
        simbolos[x["simbolo"]] = uid()

# Conta XTB
xtb_conta_id = CONTA_IDS.get("XTB", uid())

# Criar ativos para cada símbolo com transações de compra/venda
inv_map = {}
for simbolo, inv_id in simbolos.items():
    existing = dst.execute("SELECT id FROM Investment WHERE ticker=?", (simbolo,)).fetchone()
    if existing:
        inv_map[simbolo] = existing[0]
        continue
    dst.execute("""
        INSERT INTO Investment (id, nome, ticker, tipo, quantidade, precoMedioCompra, valorAtualUnidade,
            plataforma, ativa, criadoEm, atualizadoEm)
        VALUES (?, ?, ?, 'ACAO', 0, 0, 0, 'XTB', 1, datetime('now'), datetime('now'))
    """, (inv_id, simbolo, simbolo))
    inv_map[simbolo] = inv_id

dst.commit()

# Registar operações
ops_ok = 0
for x in xtb_rows:
    if not x["simbolo"]: continue
    data_x = parse_date(str(x["data"]))
    if not data_x: continue

    inv_id = inv_map.get(x["simbolo"])
    if not inv_id: continue

    valor = float(x["valor"] or 0)
    comment = str(x["comentario"] or "")

    # Determinar tipo de operação
    if "BUY" in comment.upper():
        tipo_op = "COMPRA"
        qty = 0; preco = 0
        import re
        m = re.search(r"OPEN BUY (\d+(?:\.\d+)?) @ (\d+(?:\.\d+)?)", comment)
        if m:
            qty = float(m.group(1))
            preco = float(m.group(2))
        dst.execute("""
            INSERT INTO InvestmentTransaction (id, investmentId, tipo, data, quantidade, preco, comissao, criadoEm)
            VALUES (?, ?, 'COMPRA', ?, ?, ?, 0, datetime('now'))
        """, (uid(), inv_id, data_x, qty, preco))
        ops_ok += 1
    elif "SELL" in comment.upper() or "CLOSE" in comment.upper():
        m = re.search(r"(\d+(?:\.\d+)?) @ (\d+(?:\.\d+)?)", comment)
        qty = float(m.group(1)) if m else 0
        preco = float(m.group(2)) if m else 0
        dst.execute("""
            INSERT INTO InvestmentTransaction (id, investmentId, tipo, data, quantidade, preco, comissao, criadoEm)
            VALUES (?, ?, 'VENDA', ?, ?, ?, 0, datetime('now'))
        """, (uid(), inv_id, data_x, qty, preco))
        ops_ok += 1
    elif "DIVIDEND" in comment.upper() or "dividend" in x["tipo"].lower() if x["tipo"] else False:
        dst.execute("""
            INSERT INTO InvestmentTransaction (id, investmentId, tipo, data, valorDividendo, accountId, criadoEm)
            VALUES (?, ?, 'DIVIDENDO', ?, ?, ?, datetime('now'))
        """, (uid(), inv_id, data_x, abs(valor), xtb_conta_id))
        ops_ok += 1

dst.commit()
print(f"  {len(simbolos)} ativos XTB, {ops_ok} operações migradas.")

# ── 6. Recalcular preço médio ponderado por ativo ───────────────────────────
print("A recalcular preços médios...")
for simbolo, inv_id in inv_map.items():
    ops = dst.execute("""
        SELECT tipo, quantidade, preco FROM InvestmentTransaction
        WHERE investmentId=? AND tipo IN ('COMPRA','VENDA') ORDER BY data
    """, (inv_id,)).fetchall()
    qty = 0.0; custo = 0.0
    for op in ops:
        q = float(op[1] or 0); p = float(op[2] or 0)
        if op[0] == "COMPRA":
            if qty + q > 0:
                custo = (custo * qty + p * q) / (qty + q)
            qty += q
        elif op[0] == "VENDA":
            qty = max(0, qty - q)
    if qty > 0:
        dst.execute("UPDATE Investment SET quantidade=?, precoMedioCompra=? WHERE id=?", (qty, custo, inv_id))

dst.commit()
print("  Preços médios calculados.")

# ── 7. Regras de categorização ───────────────────────────────────────────────
regras = src.execute("SELECT * FROM regras").fetchall()
if regras:
    print(f"A migrar {len(regras)} regras...")
    for r in regras:
        cat_id = map_cat(r["categoria"])
        dst.execute("""
            INSERT OR IGNORE INTO CategoryRule (id, padrao, categoryId, prioridade, criadoEm)
            VALUES (?, ?, ?, 0, datetime('now'))
        """, (uid(), r["palavra_chave"], cat_id))
    dst.commit()

src.close()
dst.close()
print("\n✅ Migração concluída com sucesso!")
