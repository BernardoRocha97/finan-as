import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — current weights vs targets
export async function GET() {
  try {
    // Current open positions (cost as market value proxy)
    const openLots = await prisma.lot.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_CLOSED"] } },
      include: { instrument: { select: { id: true, ticker: true, displayTicker: true, name: true, assetType: true, subtype: true } } },
    });

    const posMap: Record<string, { instrumentId: string; ticker: string; name: string; assetType: string; subtype: string | null; costEur: number }> = {};
    for (const lot of openLots) {
      const id = lot.instrumentId;
      if (!posMap[id]) posMap[id] = { instrumentId: id, ticker: lot.instrument.displayTicker, name: lot.instrument.name, assetType: lot.instrument.assetType, subtype: lot.instrument.subtype, costEur: 0 };
      posMap[id].costEur += Number(lot.costEur ?? 0);
    }

    const totalValue = Object.values(posMap).reduce((s, p) => s + p.costEur, 0);

    // Allocation targets
    const targets = await prisma.allocationTarget.findMany({
      where: { status: "ACTIVE" },
      include: { instrument: { select: { id: true, ticker: true, displayTicker: true, name: true } } },
      orderBy: { priority: "asc" },
    });

    const targetMap: Record<string, { targetWeight: number; minWeight: number | null; maxWeight: number | null; priority: number; notes: string | null; targetId: string }> = {};
    for (const t of targets) {
      targetMap[t.instrumentId] = {
        targetId: t.id,
        targetWeight: Number(t.targetWeight),
        minWeight: t.minWeight ? Number(t.minWeight) : null,
        maxWeight: t.maxWeight ? Number(t.maxWeight) : null,
        priority: t.priority,
        notes: t.notes,
      };
    }

    // All instruments: union of positions and targets
    const allIds = new Set([...Object.keys(posMap), ...targets.map((t) => t.instrumentId)]);

    const rows = Array.from(allIds).map((id) => {
      const pos = posMap[id];
      const tgt = targetMap[id];
      const tgtInstr = targets.find((t) => t.instrumentId === id)?.instrument;

      const ticker = pos?.ticker ?? tgtInstr?.displayTicker ?? "—";
      const name = pos?.name ?? tgtInstr?.name ?? "—";
      const costEur = pos?.costEur ?? 0;
      const currentWeight = totalValue > 0 ? (costEur / totalValue) * 100 : 0;
      const targetWeight = tgt?.targetWeight ?? 0;
      const gap = currentWeight - targetWeight; // positive = overweight
      const minWeight = tgt?.minWeight ?? null;
      const maxWeight = tgt?.maxWeight ?? null;

      let status: "OK" | "OVERWEIGHT" | "UNDERWEIGHT" | "NO_TARGET" | "NOT_HELD" = "NO_TARGET";
      if (!tgt) status = "NO_TARGET";
      else if (costEur === 0) status = "NOT_HELD";
      else if (maxWeight !== null && currentWeight > maxWeight) status = "OVERWEIGHT";
      else if (minWeight !== null && currentWeight < minWeight) status = "UNDERWEIGHT";
      else if (targetWeight > 0 && gap < -2) status = "UNDERWEIGHT";
      else if (targetWeight > 0 && gap > 2) status = "OVERWEIGHT";
      else if (tgt) status = "OK";

      return {
        instrumentId: id,
        ticker,
        name,
        assetType: pos?.assetType ?? "—",
        subtype: pos?.subtype ?? null,
        costEur: Math.round(costEur * 100) / 100,
        currentWeight: Math.round(currentWeight * 100) / 100,
        targetWeight: Math.round(targetWeight * 100) / 100,
        gap: Math.round(gap * 100) / 100,
        minWeight,
        maxWeight,
        priority: tgt?.priority ?? 99,
        notes: tgt?.notes ?? null,
        targetId: tgt?.targetId ?? null,
        status,
      };
    }).sort((a, b) => a.gap - b.gap); // most underweight first

    // Buy queue: instruments with targets that are underweight, sorted by gap asc
    const buyQueue = rows
      .filter((r) => r.status === "UNDERWEIGHT" || (r.targetWeight > 0 && r.gap < 0))
      .sort((a, b) => a.gap - b.gap);

    const targetTotal = targets.reduce((s, t) => s + Number(t.targetWeight), 0);

    return NextResponse.json({
      data: {
        rows,
        buyQueue,
        summary: {
          totalValue: Math.round(totalValue * 100) / 100,
          targetTotal: Math.round(targetTotal * 100) / 100,
          positions: Object.keys(posMap).length,
          targetsSet: targets.length,
          underweight: rows.filter((r) => r.status === "UNDERWEIGHT").length,
          overweight: rows.filter((r) => r.status === "OVERWEIGHT").length,
          ok: rows.filter((r) => r.status === "OK").length,
        },
      },
    });
  } catch (err: any) {
    console.error("Allocation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — upsert allocation target for an instrument
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instrumentId, targetWeight, minWeight, maxWeight, priority, notes } = body;

    if (!instrumentId || targetWeight === undefined) {
      return NextResponse.json({ error: "instrumentId e targetWeight são obrigatórios" }, { status: 400 });
    }

    const existing = await prisma.allocationTarget.findFirst({
      where: { instrumentId, status: "ACTIVE" },
    });

    const data = {
      targetWeight,
      minWeight: minWeight ?? null,
      maxWeight: maxWeight ?? null,
      priority: priority ?? 0,
      notes: notes ?? null,
      status: "ACTIVE",
    };

    let record;
    if (existing) {
      record = await prisma.allocationTarget.update({ where: { id: existing.id }, data });
    } else {
      record = await prisma.allocationTarget.create({ data: { instrumentId, ...data } });
    }

    return NextResponse.json({ data: record });
  } catch (err: any) {
    console.error("Allocation POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
