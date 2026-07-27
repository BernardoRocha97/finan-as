import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Listing {
  preco: number;
  area: number;
  precoPorMt2: number;
  titulo: string;
}

async function fetchImovirtual(): Promise<{ listings: Listing[]; source: string }> {
  // Imovirtual JSON API for Queluz de Baixo (locationId for Barcarena/Queluz de Baixo)
  const url =
    "https://www.imovirtual.com/api/v1/search/estates?transaction=sell&estate=house,apartment&locationId=queluz-de-baixo&limit=25&sortField=price_per_m&sortOrder=asc";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Imovirtual HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.data ?? json?.items ?? json?.results ?? [];

  const listings: Listing[] = items
    .filter((i: any) => i.price?.value && i.totalArea?.value)
    .map((i: any) => ({
      preco: i.price.value,
      area: i.totalArea.value,
      precoPorMt2: i.price.value / i.totalArea.value,
      titulo: i.title ?? "",
    }));

  return { listings, source: "Imovirtual" };
}

async function fetchCasaSapo(): Promise<{ listings: Listing[]; source: string }> {
  // Casa Sapo search for Queluz de Baixo - T2/T3 apartments/houses
  const url =
    "https://casa.sapo.pt/comprar-apartamentos/queluz/?sa=11&or=10&smi=0&smx=400000&tp=0&pi=1";

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Casa Sapo HTTP ${res.status}`);
  const html = await res.text();

  const listings: Listing[] = [];

  // Parse price and area from listings
  const listingBlocks = html.matchAll(
    /data-price="(\d+)"[^>]*data-tipology[^>]*>[\s\S]*?<span[^>]*class="[^"]*area[^"]*"[^>]*>([\d,.]+)\s*m/gi
  );

  for (const match of listingBlocks) {
    const preco = parseInt(match[1]);
    const area = parseFloat(match[2].replace(",", "."));
    if (preco > 0 && area > 0) {
      listings.push({ preco, area, precoPorMt2: preco / area, titulo: "" });
    }
  }

  // Alternative: extract price per m² directly if shown
  const pm2Matches = html.matchAll(/([\d\s]+)\s*€\/m²/g);
  const pm2Values: number[] = [];
  for (const m of pm2Matches) {
    const val = parseInt(m[1].replace(/\s/g, ""));
    if (val > 500 && val < 10000) pm2Values.push(val);
  }

  if (listings.length === 0 && pm2Values.length > 0) {
    // Use extracted €/m² values as synthetic listings
    pm2Values.forEach((v) => listings.push({ preco: v * 100, area: 100, precoPorMt2: v, titulo: "" }));
  }

  return { listings, source: "Casa Sapo" };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zona = searchParams.get("zona") ?? "Queluz de Baixo";

  let listings: Listing[] = [];
  let source = "";
  let erro = "";

  try {
    const result = await fetchImovirtual();
    listings = result.listings;
    source = result.source;
  } catch (e: any) {
    erro = e.message;
  }

  if (listings.length === 0) {
    try {
      const result = await fetchCasaSapo();
      listings = result.listings;
      source = result.source;
    } catch (e: any) {
      erro += " | " + e.message;
    }
  }

  // If both fail, use reference data from INE/Confidencial Imobiliário (2024)
  // Queluz de Baixo (Barcarena, Oeiras) renovated houses: ~€2,800–3,400/m²
  if (listings.length === 0) {
    return NextResponse.json({
      data: {
        precoPorMt2Mediano: 3100,
        precoPorMt2Min: 2800,
        precoPorMt2Max: 3400,
        numListagens: 0,
        source: "Referência INE/Confidencial Imobiliário 2024",
        zona,
        nota: "Dados de mercado em tempo real indisponíveis. Usando valores de referência para casas remodeladas em Queluz de Baixo (Barcarena, Oeiras). Fonte: INE / Confidencial Imobiliário 2024.",
        erro,
      },
    });
  }

  // Filter outliers (remove top/bottom 10%)
  const sorted = listings.sort((a, b) => a.precoPorMt2 - b.precoPorMt2);
  const trim = Math.max(1, Math.floor(sorted.length * 0.1));
  const filtered = sorted.slice(trim, sorted.length - trim);

  const values = filtered.map((l) => l.precoPorMt2);
  const mediano = median(values);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return NextResponse.json({
    data: {
      precoPorMt2Mediano: Math.round(mediano),
      precoPorMt2Min: Math.round(min),
      precoPorMt2Max: Math.round(max),
      numListagens: listings.length,
      source,
      zona,
      nota: null,
      erro: null,
    },
  });
}
