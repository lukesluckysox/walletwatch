import cron from "node-cron";
import { db } from "../db";
import { marketDataCache } from "../../shared/schema";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

async function fetchAndCache(key: string, fetcher: () => Promise<any>) {
  try {
    const data = await fetcher();

    // Upsert into cache
    const existing = await db
      .select()
      .from(marketDataCache)
      .where((col: any) => col.key.equals(key));

    if (existing.length > 0) {
      await db
        .update(marketDataCache)
        .set({ data, fetchedAt: new Date() })
        .where((col: any) => col.key.equals(key));
    } else {
      await db
        .insert(marketDataCache)
        .values({ key, data, fetchedAt: new Date() });
    }
  } catch (err) {
    console.error(`[MarketData] Failed to fetch ${key}:`, err);
  }
}

async function fetchQuote(symbol: string) {
  if (!FINNHUB_KEY) {
    console.warn("[MarketData] FINNHUB_API_KEY not set, skipping market data");
    return null;
  }
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
  );
  if (!res.ok) throw new Error(`Finnhub ${symbol}: ${res.status}`);
  return res.json();
}

export async function refreshMarketData() {
  if (!FINNHUB_KEY) {
    console.warn("[MarketData] No FINNHUB_API_KEY — skipping refresh");
    return;
  }

  console.log(`[${new Date().toISOString()}] Refreshing market data...`);

  // Core indices
  for (const symbol of ["SPY", "QQQ", "DIA"]) {
    await fetchAndCache(`quote_${symbol.toLowerCase()}`, () =>
      fetchQuote(symbol)
    );
  }

  // VIX
  await fetchAndCache("vix", () => fetchQuote("VIX"));

  // 10-Year Treasury
  await fetchAndCache("tnx", () => fetchQuote("TNX"));

  // Sector ETFs
  const sectorETFs = [
    "XLK", "XLF", "XLV", "XLE", "XLI",
    "XLC", "XLP", "XLU", "XLRE", "XLB", "XLY",
  ];
  const sectorResults: Record<string, any> = {};
  for (const s of sectorETFs) {
    try {
      sectorResults[s] = await fetchQuote(s);
      // Small delay to respect rate limits (60 calls/min)
      await new Promise((r) => setTimeout(r, 1100));
    } catch (err) {
      console.error(`[MarketData] Sector ${s} failed:`, err);
    }
  }
  await fetchAndCache("sectors", async () => sectorResults);

  console.log(`[${new Date().toISOString()}] Market data refresh complete`);
}

export function startMarketDataCron() {
  // Run every 15 minutes during US market hours (9:30 AM – 4:00 PM ET, Mon-Fri)
  cron.schedule("0,15,30,45 9-16 * * 1-5", refreshMarketData, {
    timezone: "America/New_York",
  });

  // Also run once on startup
  refreshMarketData().catch(console.error);

  console.log("[MarketData] Cron scheduled: every 15min during market hours");
}
