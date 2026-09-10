// Shared Yahoo Finance price fetching for portfolio routes

export function toYahooSymbol(displayTicker: string): string {
  if (displayTicker.endsWith(".US")) return displayTicker.slice(0, -3);
  if (displayTicker.endsWith(".UK")) return displayTicker.slice(0, -3) + ".L";
  return displayTicker; // .DE already valid for Yahoo
}

export async function fetchYahooPrice(symbol: string): Promise<{ price: number | null; currency: string | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { price: null, currency: null };
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    return { price: meta?.regularMarketPrice ?? meta?.previousClose ?? null, currency: meta?.currency ?? null };
  } catch {
    return { price: null, currency: null };
  }
}

export async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const { price } = await fetchYahooPrice(`${from}${to}=X`);
  return price ?? 1;
}

export function toEur(price: number, currency: string, usdEur: number, gbpEur: number): number {
  const c = currency.toUpperCase();
  if (c === "USD") return price * usdEur;
  if (c === "GBP" || c === "GBp") return (price / (c === "GBp" ? 100 : 1)) * gbpEur;
  return price; // EUR or unknown
}
