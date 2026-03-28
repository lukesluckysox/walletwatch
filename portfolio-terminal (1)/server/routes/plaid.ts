import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { plaidClient } from "../lib/plaid";
import { encrypt, decrypt } from "../lib/encryption";
import { db } from "../db";
import { plaidItems, cachedHoldings } from "../../shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { Products, CountryCode } from "plaid";

const router = Router();

// POST /api/plaid/create-link-token
router.post("/create-link-token", requireAuth, async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.session.userId! },
      client_name: "Portfolio Terminal",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error("Create link token error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

// POST /api/plaid/exchange-token
router.post("/exchange-token", requireAuth, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: "public_token required" });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;

    // Encrypt access_token before storing
    const encryptedToken = encrypt(access_token);

    // Get institution info
    let institutionName = "Unknown";
    try {
      const itemResponse = await plaidClient.itemGet({ access_token });
      const instId = itemResponse.data.item.institution_id;
      if (instId) {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: instId,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      }
    } catch {
      // Non-critical — institution name is just for display
    }

    // Store in DB
    await db.insert(plaidItems).values({
      userId: req.session.userId!,
      accessToken: encryptedToken,
      itemId: item_id,
      institutionName,
    });

    res.json({ success: true, institutionName });
  } catch (err: any) {
    console.error("Exchange token error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

// GET /api/plaid/holdings
router.get("/holdings", requireAuth, async (req, res) => {
  try {
    // Check cache first (15-minute TTL)
    const cached = await db
      .select()
      .from(cachedHoldings)
      .where(
        and(
          eq(cachedHoldings.userId, req.session.userId!),
          gt(
            cachedHoldings.fetchedAt,
            new Date(Date.now() - 15 * 60 * 1000)
          )
        )
      );

    if (cached.length > 0) {
      return res.json(cached[0].data);
    }

    // Fetch from Plaid for each linked account
    const items = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.session.userId!));

    if (items.length === 0) {
      return res.json({ accounts: [], holdings: [], securities: [] });
    }

    const allAccounts: any[] = [];
    const allHoldings: any[] = [];
    const allSecurities: any[] = [];

    for (const item of items) {
      const accessToken = decrypt(item.accessToken);
      const response = await plaidClient.investmentsHoldingsGet({
        access_token: accessToken,
      });
      allAccounts.push(
        ...response.data.accounts.map((a) => ({
          ...a,
          institution: item.institutionName,
        }))
      );
      allHoldings.push(...response.data.holdings);
      allSecurities.push(...response.data.securities);
    }

    const result = {
      accounts: allAccounts,
      holdings: allHoldings,
      securities: allSecurities,
    };

    // Cache result (upsert)
    const existingCache = await db
      .select()
      .from(cachedHoldings)
      .where(eq(cachedHoldings.userId, req.session.userId!));

    if (existingCache.length > 0) {
      await db
        .update(cachedHoldings)
        .set({ data: result, fetchedAt: new Date() })
        .where(eq(cachedHoldings.userId, req.session.userId!));
    } else {
      await db.insert(cachedHoldings).values({
        userId: req.session.userId!,
        data: result,
        fetchedAt: new Date(),
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error("Holdings error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to fetch holdings" });
  }
});

// GET /api/plaid/transactions
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const items = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.session.userId!));

    const allTransactions: any[] = [];
    for (const item of items) {
      const accessToken = decrypt(item.accessToken);
      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000
      );

      const response = await plaidClient.investmentsTransactionsGet({
        access_token: accessToken,
        start_date: thirtyDaysAgo.toISOString().split("T")[0],
        end_date: now.toISOString().split("T")[0],
      });
      allTransactions.push(...response.data.investment_transactions);
    }

    res.json(allTransactions);
  } catch (err: any) {
    console.error("Transactions error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// POST /api/plaid/refresh
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const items = await db
      .select()
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.session.userId!));

    for (const item of items) {
      const accessToken = decrypt(item.accessToken);
      await plaidClient.investmentsRefresh({ access_token: accessToken });
    }

    // Clear cache to force fresh fetch
    await db
      .delete(cachedHoldings)
      .where(eq(cachedHoldings.userId, req.session.userId!));

    res.json({ success: true });
  } catch (err: any) {
    console.error("Refresh error:", err.response?.data || err);
    res.status(500).json({ error: "Failed to refresh investments" });
  }
});

// GET /api/plaid/accounts — list linked brokerage accounts
router.get("/accounts", requireAuth, async (req, res) => {
  try {
    const items = await db
      .select({
        id: plaidItems.id,
        institutionName: plaidItems.institutionName,
        createdAt: plaidItems.createdAt,
      })
      .from(plaidItems)
      .where(eq(plaidItems.userId, req.session.userId!));

    res.json(items);
  } catch (err: any) {
    console.error("Accounts error:", err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

export default router;
