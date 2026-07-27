const Database = require("better-sqlite3");
const path = require("path");
const { Client } = require("pg");

const DB_PATH = path.join(__dirname, "../prisma/finances.db");
const NEON_URL = "postgresql://neondb_owner:npg_mQfC1pLWyj9e@ep-muddy-wind-zarms2g4-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function migrate() {
  const sqlite = new Database(DB_PATH);
  const pg = new Client({ connectionString: NEON_URL });
  await pg.connect();

  const tables = [
    "Category", "Account", "Transaction", "Goal", "GoalContribution",
    "Investment", "InvestmentTransaction", "Property", "Mortgage",
    "MortgagePayment", "NetWorthSnapshot", "MonthlyReport",
    "ImportLog", "CategoryRule", "Preference",
  ];

  for (const table of tables) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (!rows.length) { console.log(`${table}: vazio`); continue; }

    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      const vals = cols.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        // Booleans stored as 0/1 in SQLite
        if (typeof v === "number" && (c === "ativa" || c === "importada" || c === "revisada" || c === "mostrarFireNumber")) return v === 1;
        return v;
      });
      try {
        await pg.query(sql, vals);
        inserted++;
      } catch (e) {
        console.error(`  Erro em ${table}:`, e.message, JSON.stringify(row).slice(0, 100));
      }
    }
    console.log(`${table}: ${inserted}/${rows.length} migrados`);
  }

  await pg.end();
  sqlite.close();
  console.log("\nMigração concluída!");
}

migrate().catch(console.error);
