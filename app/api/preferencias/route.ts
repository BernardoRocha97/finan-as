export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prefs = await prisma.preference.findUnique({ where: { id: "singleton" } });
  return NextResponse.json({ data: prefs });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const prefs = await prisma.preference.upsert({
    where: { id: "singleton" },
    update: body,
    create: { id: "singleton", ...body },
  });
  return NextResponse.json({ data: prefs });
}

