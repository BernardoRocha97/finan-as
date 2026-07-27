/**
 * XTB xStation5 API client (WebSocket, server-side only)
 * Docs: http://developers.xstore.pro/documentation/
 */
import WebSocket from "ws";

const WS_URL = {
  real: "wss://ws.xtb.com/real",
  demo: "wss://ws.xtb.com/demo",
};

export interface XtbTrade {
  order: number;
  symbol: string;
  cmd: number;       // 0=BUY 1=SELL 2=BUY_LIMIT ...
  volume: number;
  open_price: number;
  close_price: number;
  open_time: number;
  close_time: number;
  profit: number;
  commission: number;
  storage: number;   // swap
  comment: string;
  closed: boolean;
  digits: number;
  sl: number;
  tp: number;
  expiration: number | null;
  nominalValue: number;
  taxes: number;
  margin_rate: number;
}

export interface XtbBalance {
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  credit: number;
  currency: string;
}

export interface XtbSymbol {
  symbol: string;
  description: string;
  bid: number;
  ask: number;
  categoryName: string;
  currency: string;
  currency_profit: string;
  contractSize: number;
  lotMin: number;
  lotMax: number;
  lotStep: number;
  precision: number;
  type: number;
}

type AccountType = "real" | "demo";

function xtbCommand(ws: WebSocket, command: string, args?: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const msg: Record<string, unknown> = { command };
    if (args) msg.arguments = args;

    const timeout = setTimeout(() => reject(new Error(`Timeout: ${command}`)), 15000);

    const onMsg = (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.status === true || data.status === false) {
          clearTimeout(timeout);
          ws.off("message", onMsg);
          if (data.status === false) {
            reject(new Error(data.errorDescr ?? data.errorCode ?? "XTB error"));
          } else {
            resolve(data.returnData ?? data);
          }
        }
      } catch { /* ignore non-JSON frames */ }
    };

    ws.on("message", onMsg);
    ws.send(JSON.stringify(msg));
  });
}

export async function withXtbClient<T>(
  fn: (ws: WebSocket) => Promise<T>,
  accountType: AccountType = "real"
): Promise<T> {
  const userId = process.env.XTB_USER_ID;
  const password = process.env.XTB_PASSWORD;
  if (!userId || !password) throw new Error("XTB_USER_ID e XTB_PASSWORD não configurados em .env");

  const url = WS_URL[accountType] ?? WS_URL.real;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { handshakeTimeout: 10000 });

    ws.once("error", (err) => reject(err));

    ws.once("open", async () => {
      try {
        // login
        await xtbCommand(ws, "login", { userId, password, type: accountType });
        const result = await fn(ws);
        ws.close();
        resolve(result);
      } catch (err) {
        ws.close();
        reject(err);
      }
    });
  });
}

// ── High-level helpers ───────────────────────────────────────────────────────

export async function getXtbBalance(accountType: AccountType = "real"): Promise<XtbBalance> {
  return withXtbClient(async (ws) => {
    return xtbCommand(ws, "getMarginLevel");
  }, accountType);
}

export async function getXtbOpenTrades(accountType: AccountType = "real"): Promise<XtbTrade[]> {
  return withXtbClient(async (ws) => {
    return xtbCommand(ws, "getTrades", { openedOnly: true });
  }, accountType);
}

export async function getXtbTradeHistory(
  start: number,
  end: number,
  accountType: AccountType = "real"
): Promise<XtbTrade[]> {
  return withXtbClient(async (ws) => {
    return xtbCommand(ws, "getTradesHistory", { start, end });
  }, accountType);
}

export async function getXtbSymbol(symbol: string, accountType: AccountType = "real"): Promise<XtbSymbol> {
  return withXtbClient(async (ws) => {
    return xtbCommand(ws, "getSymbol", { symbol });
  }, accountType);
}

export async function getXtbSymbols(symbols: string[], accountType: AccountType = "real"): Promise<XtbSymbol[]> {
  return withXtbClient(async (ws) => {
    const results = await Promise.all(
      symbols.map((s) => xtbCommand(ws, "getSymbol", { symbol: s }).catch(() => null))
    );
    return results.filter(Boolean) as XtbSymbol[];
  }, accountType);
}

/** Fetch balance + open positions in a single connection */
export async function getXtbPortfolio(accountType: AccountType = "real") {
  return withXtbClient(async (ws) => {
    const [balance, trades] = await Promise.all([
      xtbCommand(ws, "getMarginLevel"),
      xtbCommand(ws, "getTrades", { openedOnly: true }),
    ]);

    // Get current prices for all unique symbols
    const symbols: string[] = [...new Set((trades as XtbTrade[]).map((t) => t.symbol))];
    const symbolData: Record<string, XtbSymbol> = {};
    for (const sym of symbols) {
      try {
        const sd = await xtbCommand(ws, "getSymbol", { symbol: sym });
        symbolData[sym] = sd;
      } catch { /* skip unknown symbols */ }
    }

    return { balance: balance as XtbBalance, trades: trades as XtbTrade[], symbolData };
  }, accountType);
}

/** cmd codes → readable */
export function cmdLabel(cmd: number): string {
  return ["BUY", "SELL", "BUY LIMIT", "SELL LIMIT", "BUY STOP", "SELL STOP"][cmd] ?? `CMD${cmd}`;
}
