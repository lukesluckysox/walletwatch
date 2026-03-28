import { Router } from "express";
import { db } from "../db";
import { marketDataCache } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/market — all cached market data
router.get("/", async (_req, res) => {
  try {
    const all = await db.select().from(marketDataCache);
    const result: Record<string, any> = {};
    for (const row of all) {
      result[row.key] = { data: row.data, fetchedAt: row.fetchedAt };
    }
    res.json(result);
  } catch (err: any) {
    console.error("Market data error:", err);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

// GET /api/market/:key  (e.g., /api/market/vix, /api/market/quote_spy)
router.get("/:key", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(marketDataCache)
      .where(eq(marketDataCache.key, req.params.key));

    if (result.length === 0) {
      return res.status(404).json({ error: "Data not available" });
    }

    res.json({
      data: result[0].data,
      fetchedAt: result[0].fetchedAt,
    });
  } catch (err: any) {
    console.error("Market data error:", err);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

export default router;
