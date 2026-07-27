export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "prisma", "finances.db");

export async function GET() {
  if (!existsSync(DB_PATH)) {
    return NextResponse.json({ error: "Base de dados nÃ£o encontrada" }, { status: 404 });
  }
  const buffer = readFileSync(DB_PATH);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="finances-backup-${new Date().toISOString().slice(0, 10)}.db"`,
    },
  });
}

