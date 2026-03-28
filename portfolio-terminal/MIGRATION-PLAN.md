# Multi-User Portfolio Terminal: Implementation Plan

> Convert a single-user Express + React portfolio terminal app to a multi-user platform with Plaid brokerage integration, deployed on Railway.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Plaid Integration Architecture](#2-plaid-integration-architecture)
3. [Authentication System](#3-authentication-system)
4. [Database Schema (Drizzle ORM)](#4-database-schema-drizzle-orm)
5. [Market Data Strategy](#5-market-data-strategy)
6. [Railway Deployment](#6-railway-deployment)
7. [Migration Steps (Ordered)](#7-migration-steps-ordered)
8. [File-by-File Changes](#8-file-by-file-changes)
9. [Cost Estimate](#9-cost-estimate)
10. [Security Considerations](#10-security-considerations)

---

## 1. Architecture Overview

### Current State

```
Client (React + Vite)          Server (Express)
┌──────────────────┐           ┌──────────────────┐
│ Hash Router      │           │ Static file serve │
│ 4 Pages          │  ──────>  │ No real API       │
│ Hardcoded JSON   │           │ SQLite (unused?)  │
│ Client-side auth │           │ No auth middleware │
└──────────────────┘           └──────────────────┘
```

### Target State

```
Client (React + Vite)              Server (Express)                    External
┌───────────────────────┐          ┌──────────────────────┐           ┌──────────┐
│ Real login/register   │          │ Session auth          │           │ Plaid API│
│ Plaid Link widget     │  ─────>  │ /api/auth/*           │  ──────> │          │
│ Live portfolio data   │          │ /api/plaid/*          │           └──────────┘
│ Loading/error states  │          │ /api/market/*         │           ┌──────────┐
│ Hash router (wouter)  │          │ Auth middleware        │  ──────> │ Market   │
└───────────────────────┘          │ Cron: market refresh  │           │ Data API │
                                   │ PostgreSQL (Drizzle)  │           └──────────┘
                                   └──────────────────────┘
                                            │
                                   ┌──────────────────────┐
                                   │ Railway PostgreSQL    │
                                   └──────────────────────┘
```

---

## 2. Plaid Integration Architecture

### 2.1 Sign Up for Plaid

1. Create account at [dashboard.plaid.com](https://dashboard.plaid.com)
2. Free tier includes: unlimited sandbox calls + 200 live API calls per product
3. Get `PLAID_CLIENT_ID` and `PLAID_SECRET` from the dashboard
4. Use `sandbox` environment during development, switch to `production` for launch
5. Request Investments product access in the Plaid Dashboard (may require brief application)

### 2.2 Install Dependencies

```bash
# Backend
npm install plaid

# Frontend
npm install react-plaid-link
```

### 2.3 Plaid Client Setup

Create `server/lib/plaid.ts`:

```typescript
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);
```

### 2.4 Backend Endpoints

All endpoints require authentication middleware (see Section 3).

#### `POST /api/plaid/create-link-token`

```typescript
app.post('/api/plaid/create-link-token', requireAuth, async (req, res) => {
  const request = {
    user: { client_user_id: req.session.userId },
    client_name: 'Portfolio Terminal',
    products: ['investments'],
    country_codes: ['US'],
    language: 'en',
  };
  const response = await plaidClient.linkTokenCreate(request);
  res.json({ link_token: response.data.link_token });
});
```

#### `POST /api/plaid/exchange-token`

```typescript
app.post('/api/plaid/exchange-token', requireAuth, async (req, res) => {
  const { public_token } = req.body;
  const response = await plaidClient.itemPublicTokenExchange({ public_token });

  const { access_token, item_id } = response.data;

  // Encrypt access_token before storing
  const encrypted = encrypt(access_token);

  // Get institution info
  const itemResponse = await plaidClient.itemGet({ access_token });
  const instId = itemResponse.data.item.institution_id;
  const instResponse = await plaidClient.institutionsGetById({
    institution_id: instId,
    country_codes: ['US'],
  });

  // Store in DB
  await db.insert(plaidItems).values({
    userId: req.session.userId,
    accessToken: encrypted,
    itemId: item_id,
    institutionName: instResponse.data.institution.name,
  });

  res.json({ success: true });
});
```

#### `GET /api/plaid/holdings`

```typescript
app.get('/api/plaid/holdings', requireAuth, async (req, res) => {
  // Check cache first (avoid redundant Plaid calls)
  const cached = await db.select().from(cachedHoldings)
    .where(and(
      eq(cachedHoldings.userId, req.session.userId),
      gt(cachedHoldings.fetchedAt, new Date(Date.now() - 15 * 60 * 1000)) // 15 min TTL
    ))
    .limit(1);

  if (cached.length > 0) {
    return res.json(JSON.parse(cached[0].data));
  }

  // Fetch from Plaid for each linked account
  const items = await db.select().from(plaidItems)
    .where(eq(plaidItems.userId, req.session.userId));

  const allHoldings = [];
  for (const item of items) {
    const accessToken = decrypt(item.accessToken);
    const response = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });
    allHoldings.push({
      accounts: response.data.accounts,
      holdings: response.data.holdings,
      securities: response.data.securities,
    });
  }

  // Cache result
  await db.insert(cachedHoldings).values({
    userId: req.session.userId,
    data: JSON.stringify(allHoldings),
    fetchedAt: new Date(),
  }).onConflictDoUpdate({
    target: cachedHoldings.userId,
    set: { data: JSON.stringify(allHoldings), fetchedAt: new Date() },
  });

  res.json(allHoldings);
});
```

#### `GET /api/plaid/transactions`

```typescript
app.get('/api/plaid/transactions', requireAuth, async (req, res) => {
  const items = await db.select().from(plaidItems)
    .where(eq(plaidItems.userId, req.session.userId));

  const allTransactions = [];
  for (const item of items) {
    const accessToken = decrypt(item.accessToken);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const response = await plaidClient.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });
    allTransactions.push(...response.data.investment_transactions);
  }

  res.json(allTransactions);
});
```

#### `POST /api/plaid/refresh`

```typescript
app.post('/api/plaid/refresh', requireAuth, async (req, res) => {
  const items = await db.select().from(plaidItems)
    .where(eq(plaidItems.userId, req.session.userId));

  for (const item of items) {
    const accessToken = decrypt(item.accessToken);
    await plaidClient.investmentsRefresh({ access_token: accessToken });
  }

  // Clear cache to force fresh fetch
  await db.delete(cachedHoldings)
    .where(eq(cachedHoldings.userId, req.session.userId));

  res.json({ success: true });
});
```

### 2.5 Frontend: Plaid Link Widget

```tsx
// client/src/components/PlaidLink.tsx
import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/plaid/create-link-token', { method: 'POST' })
      .then(res => res.json())
      .then(data => setLinkToken(data.link_token));
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    await fetch('/api/plaid/exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken }),
    });
    // Trigger portfolio data refresh
    window.location.reload();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="px-4 py-2 bg-amber-500/20 border border-amber-500/50 text-amber-400
                 font-mono text-sm hover:bg-amber-500/30 transition-colors disabled:opacity-50"
    >
      + Link Brokerage Account
    </button>
  );
}
```

### 2.6 Environment Variables

```env
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox          # sandbox | production
ENCRYPTION_KEY=32-byte-hex-key-for-aes-256
```

---

## 3. Authentication System

### Recommendation: Session-based auth with `express-session`

Session-based auth is simpler than JWT for this use case — no token refresh logic, easy logout via session destruction, and the server already runs Express.

### 3.1 Install Dependencies

```bash
npm install express-session better-sqlite3-session-store bcrypt
npm install -D @types/express-session @types/bcrypt
```

> **Note:** If migrating to PostgreSQL (see Section 6), use `connect-pg-simple` instead of `better-sqlite3-session-store`.

```bash
# For PostgreSQL
npm install connect-pg-simple
```

### 3.2 Session Middleware

```typescript
// server/middleware/session.ts
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';

const PgSession = ConnectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
```

### 3.3 Auth Endpoints

```typescript
// server/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const SALT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db.insert(users).values({ email, passwordHash }).returning();

  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ userId: req.session.userId });
});

export default router;
```

### 3.4 Auth Middleware

```typescript
// server/middleware/requireAuth.ts
import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
```

### 3.5 Session Type Augmentation

```typescript
// server/types/express-session.d.ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
```

---

## 4. Database Schema (Drizzle ORM)

### 4.1 Switch from SQLite to PostgreSQL

Drizzle ORM supports both SQLite and PostgreSQL. The migration involves:

1. Change imports from `drizzle-orm/better-sqlite3` to `drizzle-orm/node-postgres`
2. Change schema column types from `sqliteTable` to `pgTable`
3. Change `integer` to `serial`/`integer`, `text` to `text`/`varchar`
4. Update `drizzle.config.ts` to use `dialect: 'postgresql'`

```bash
# Remove SQLite, add PostgreSQL
npm uninstall better-sqlite3
npm install pg
npm install -D @types/pg
```

### 4.2 Schema Definition

```typescript
// server/db/schema.ts
import { pgTable, text, timestamp, serial, json, uuid } from 'drizzle-orm/pg-core';

// ── Users ──────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

// ── Plaid Items (linked brokerage accounts) ────────────
export const plaidItems = pgTable('plaid_items', {
  id:              serial('id').primaryKey(),
  userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken:     text('access_token').notNull(),  // AES-256-GCM encrypted
  itemId:          text('item_id').notNull().unique(),
  institutionName: text('institution_name'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
});

// ── Cached Holdings (per-user, with TTL) ───────────────
export const cachedHoldings = pgTable('cached_holdings', {
  id:        serial('id').primaryKey(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  data:      json('data').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

// ── Market Data Cache (shared across all users) ────────
export const marketDataCache = pgTable('market_data_cache', {
  id:        serial('id').primaryKey(),
  key:       text('key').notNull().unique(),   // e.g., 'vix', 'spy_price', 'sector_performance'
  data:      json('data').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
});

// ── Sessions (managed by connect-pg-simple, auto-created) ──
// No Drizzle definition needed — connect-pg-simple creates its own table.
```

### 4.3 Database Connection

```typescript
// server/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

### 4.4 Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 4.5 Run Migrations

```bash
npx drizzle-kit generate   # Generate SQL migration files
npx drizzle-kit migrate    # Apply migrations to the database
```

---

## 5. Market Data Strategy

Market data (VIX, SPY, QQQ, sector performance, options flow) is **shared across all users** — it is not per-user data. This means you fetch it once and serve it to everyone.

### 5.1 API Options (Ranked)

| Provider | Free Tier | Rate Limit | Best For |
|----------|-----------|------------|----------|
| **Alpha Vantage** | 25 requests/day | 25/day (free key) | Historical prices, fundamentals |
| **Finnhub** | Free tier available | 60 calls/min | Real-time quotes, market news |
| **Polygon.io** | Free tier | 5 calls/min | Historical bars, options data |
| **Yahoo Finance** (unofficial) | Unlimited (unofficial) | No official limit | Quick price lookups |

**Recommendation:** Use **Finnhub** (free tier, 60 calls/min) for real-time quotes and VIX/SPY/QQQ data. Use **Alpha Vantage** as a backup for historical data. These free tiers are more than sufficient for <50 users.

### 5.2 Cron-Based Refresh

Market data should refresh on a schedule, not on every page load. Use `node-cron` to refresh during market hours.

```bash
npm install node-cron
npm install -D @types/node-cron
```

```typescript
// server/jobs/marketData.ts
import cron from 'node-cron';
import { db } from '../db';
import { marketDataCache } from '../db/schema';
import { eq } from 'drizzle-orm';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

async function fetchAndCache(key: string, fetcher: () => Promise<any>) {
  const data = await fetcher();
  await db.insert(marketDataCache)
    .values({ key, data, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: marketDataCache.key,
      set: { data, fetchedAt: new Date() },
    });
}

async function refreshMarketData() {
  // VIX
  await fetchAndCache('vix', async () => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=VIX&token=${FINNHUB_KEY}`);
    return res.json();
  });

  // SPY, QQQ, DIA
  for (const symbol of ['SPY', 'QQQ', 'DIA']) {
    await fetchAndCache(`quote_${symbol.toLowerCase()}`, async () => {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
      return res.json();
    });
  }

  // Sector performance (use Finnhub sector metrics or Alpha Vantage SECTOR endpoint)
  await fetchAndCache('sectors', async () => {
    // Example: fetch sector ETFs (XLK, XLF, XLV, XLE, XLI, XLC, XLP, XLU, XLRE, XLB, XLY)
    const sectors = ['XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLC', 'XLP', 'XLU', 'XLRE', 'XLB', 'XLY'];
    const results: Record<string, any> = {};
    for (const s of sectors) {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${FINNHUB_KEY}`);
      results[s] = await res.json();
    }
    return results;
  });

  console.log(`[${new Date().toISOString()}] Market data refreshed`);
}

// Run every 15 minutes during US market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
// Cron: minute 0,15,30,45, hours 9-16, weekdays
cron.schedule('0,15,30,45 9-16 * * 1-5', refreshMarketData, {
  timezone: 'America/New_York',
});

// Also run once on startup
refreshMarketData();
```

### 5.3 Market Data API Endpoints

```typescript
// server/routes/market.ts
import { Router } from 'express';
import { db } from '../db';
import { marketDataCache } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/market/:key  (e.g., /api/market/vix, /api/market/quote_spy)
router.get('/:key', async (req, res) => {
  const result = await db.select().from(marketDataCache)
    .where(eq(marketDataCache.key, req.params.key))
    .limit(1);

  if (result.length === 0) {
    return res.status(404).json({ error: 'Data not available' });
  }

  res.json({
    data: result[0].data,
    fetchedAt: result[0].fetchedAt,
  });
});

// GET /api/market (all cached market data)
router.get('/', async (req, res) => {
  const all = await db.select().from(marketDataCache);
  const result: Record<string, any> = {};
  for (const row of all) {
    result[row.key] = { data: row.data, fetchedAt: row.fetchedAt };
  }
  res.json(result);
});

export default router;
```

### 5.4 Page-to-Data Mapping

| Page | Data Source | Per-User? |
|------|-----------|-----------|
| Portfolio Terminal | Plaid `/investments/holdings/get` | Yes |
| Should I Be Trading? | VIX, SPY, QQQ market data | No (shared) |
| Options Flow Scanner | Options market data (Finnhub/Polygon) | No (shared) |
| Sector Rotation Dashboard | Sector ETF performance | No (shared) |

---

## 6. Railway Deployment

### 6.1 Why Railway

- Single service hosts both Express API and React static build
- Built-in PostgreSQL provisioning
- Automatic SSL/HTTPS
- GitHub integration for auto-deploy on push
- Environment variable management in dashboard

### 6.2 Railway Plans

| Feature | Free Trial | Hobby |
|---------|-----------|-------|
| Cost | $0 (30-day trial, $5 credit) | $5/mo + usage (includes $20 credit) |
| vCPU | Up to 1 | Up to 48 |
| RAM | Up to 0.5 GB | Up to 48 GB |
| Storage | 0.5 GB | Up to 5 GB |
| Cron Jobs | Yes (trial only) | 50 per project |

Usage-based pricing beyond credits: ~$0.000231/vCPU-hour, ~$0.000014/GB-RAM-sec. A small app with PostgreSQL will easily fit within the $20 monthly credit on Hobby.

### 6.3 PostgreSQL on Railway

Railway provisions PostgreSQL as a separate service in your project. No separate addon pricing — it uses the same usage-based compute/storage billing:

- **Storage:** ~$0.000002/GB-sec (~$0.15/GB-month)
- **Compute:** same CPU/RAM rates as above
- A small database (<1 GB) costs negligible amounts

### 6.4 Project Structure for Deploy

```
railway.json (or use auto-detection)
├── Dockerfile (optional — nixpacks auto-detects Node.js)
├── package.json
├── server/
│   └── index.ts          # Express app entry
├── client/
│   └── src/              # React app
└── drizzle/
    └── migrations/       # SQL migration files
```

### 6.5 Build & Start Commands

In `package.json`:

```json
{
  "scripts": {
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Railway auto-runs `npm run build` then `npm start`. Add a deploy hook or startup script to run migrations:

```typescript
// In server/index.ts, before app.listen():
import { migrate } from 'drizzle-orm/node-postgres/migrator';

await migrate(db, { migrationsFolder: './drizzle' });
```

### 6.6 Environment Variables (Railway Dashboard)

```
DATABASE_URL=postgresql://...        # Auto-set by Railway Postgres addon
SESSION_SECRET=random-64-char-string
PLAID_CLIENT_ID=your_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox
ENCRYPTION_KEY=32-byte-hex
FINNHUB_API_KEY=your_key
NODE_ENV=production
```

### 6.7 Deploy Steps

1. Push code to GitHub
2. Create Railway project → "Deploy from GitHub repo"
3. Add PostgreSQL service: "New" → "Database" → "PostgreSQL"
4. Railway auto-injects `DATABASE_URL` as a reference variable
5. Add remaining env vars in Railway dashboard
6. Deploy triggers automatically on push

---

## 7. Migration Steps (Ordered)

Execute these in sequence. Each step should result in a working (if incomplete) app.

### Step 1: Switch DB from SQLite to PostgreSQL

- [ ] `npm uninstall better-sqlite3`; `npm install pg @types/pg`
- [ ] Rewrite `server/db/schema.ts`: change `sqliteTable` → `pgTable`, update column types
- [ ] Rewrite `server/db/index.ts`: use `pg.Pool` + `drizzle(pool)`
- [ ] Update `drizzle.config.ts`: `dialect: 'postgresql'`
- [ ] Run locally with `docker run -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16`
- [ ] `npx drizzle-kit generate && npx drizzle-kit migrate`
- [ ] Verify existing app still works against Postgres

### Step 2: Add Users Table and Auth System

- [ ] Add `users` table to schema (see Section 4.2)
- [ ] `npm install express-session connect-pg-simple bcrypt`
- [ ] Create `server/middleware/session.ts` (see Section 3.2)
- [ ] Create `server/routes/auth.ts` with register/login/logout/me (see Section 3.3)
- [ ] Create `server/middleware/requireAuth.ts` (see Section 3.4)
- [ ] Wire up session middleware and auth routes in `server/index.ts`
- [ ] Generate + apply migration
- [ ] Test with curl/Postman: register, login, access /api/auth/me

### Step 3: Add Plaid Integration

- [ ] Sign up at dashboard.plaid.com, get credentials
- [ ] `npm install plaid react-plaid-link`
- [ ] Create `server/lib/plaid.ts` (client setup, see Section 2.3)
- [ ] Create `server/lib/encryption.ts` (AES-256-GCM, see Section 10)
- [ ] Add `plaidItems` and `cachedHoldings` tables to schema
- [ ] Create `server/routes/plaid.ts` with all 5 endpoints (see Section 2.4)
- [ ] Generate + apply migration
- [ ] Test in sandbox: create link token, open Plaid Link, exchange token, fetch holdings

### Step 4: Replace Hardcoded JSON with Per-User Plaid Data

- [ ] Update Portfolio Terminal page to call `GET /api/plaid/holdings`
- [ ] Add loading skeleton while data fetches
- [ ] Add "Link Brokerage Account" button (Plaid Link widget) if no accounts linked
- [ ] Add error states for API failures
- [ ] Remove or gate hardcoded JSON files (keep as fallback/demo mode if desired)
- [ ] Map Plaid holdings response to existing portfolio display components

### Step 5: Add Market Data Fetching

- [ ] Sign up for Finnhub free API key
- [ ] `npm install node-cron @types/node-cron`
- [ ] Add `marketDataCache` table to schema, generate + apply migration
- [ ] Create `server/jobs/marketData.ts` (cron job, see Section 5.2)
- [ ] Create `server/routes/market.ts` (see Section 5.3)
- [ ] Wire up cron job startup and market routes in `server/index.ts`

### Step 6: Update Frontend

- [ ] Replace client-side login check with real auth flow:
  - Login page calls `POST /api/auth/login`
  - Registration page calls `POST /api/auth/register`
  - App checks `GET /api/auth/me` on load; redirect to login if 401
- [ ] Add Plaid Link widget to Portfolio Terminal page
- [ ] Update "Should I Be Trading?" page to fetch from `/api/market/vix`, etc.
- [ ] Update Options Flow Scanner to fetch from `/api/market/...`
- [ ] Update Sector Rotation Dashboard to fetch from `/api/market/sectors`
- [ ] Add loading spinners/skeletons for all data-fetching states
- [ ] Keep hash routing via wouter (no change needed)

### Step 7: Deploy on Railway

- [ ] Push to GitHub
- [ ] Create Railway project, connect GitHub repo
- [ ] Provision PostgreSQL service
- [ ] Set environment variables
- [ ] Verify build + deploy succeeds
- [ ] Test full flow: register → login → link Plaid sandbox account → view portfolio
- [ ] (Optional) Add custom domain

---

## 8. File-by-File Changes

### New Files to Create

| File | Purpose |
|------|---------|
| `server/db/schema.ts` | PostgreSQL schema (users, plaid_items, cached_holdings, market_data_cache) |
| `server/db/index.ts` | Drizzle + pg.Pool connection |
| `server/routes/auth.ts` | Register, login, logout, me endpoints |
| `server/routes/plaid.ts` | Plaid link token, exchange, holdings, transactions, refresh |
| `server/routes/market.ts` | Cached market data endpoints |
| `server/middleware/session.ts` | express-session with connect-pg-simple |
| `server/middleware/requireAuth.ts` | Auth guard middleware |
| `server/lib/plaid.ts` | Plaid API client configuration |
| `server/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for access tokens |
| `server/jobs/marketData.ts` | Cron job for refreshing VIX, SPY, QQQ, sector data |
| `server/types/express-session.d.ts` | TypeScript session type augmentation |
| `client/src/components/PlaidLink.tsx` | Plaid Link widget component |
| `client/src/components/LoginForm.tsx` | Real login form |
| `client/src/components/RegisterForm.tsx` | Registration form |
| `client/src/hooks/useAuth.ts` | Auth state hook (check session, login, logout) |
| `client/src/hooks/useMarketData.ts` | Hook for fetching cached market data |
| `client/src/hooks/useHoldings.ts` | Hook for fetching user's Plaid holdings |
| `drizzle.config.ts` | Updated Drizzle config for PostgreSQL |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add dependencies: `plaid`, `react-plaid-link`, `pg`, `express-session`, `connect-pg-simple`, `bcrypt`, `node-cron`, `helmet`, `express-rate-limit`. Remove: `better-sqlite3`. Update build/start scripts. |
| `server/index.ts` (or `server/main.ts`) | Add session middleware, mount auth/plaid/market routers, import cron jobs, run migrations on startup, add helmet + rate-limit + CORS middleware. |
| `client/src/pages/PortfolioTerminal.tsx` | Replace hardcoded JSON imports with `useHoldings()` hook. Add Plaid Link button. Add loading/error states. |
| `client/src/pages/ShouldIBeTrading.tsx` | Replace static VIX/SPY data with `useMarketData('vix')` hook. |
| `client/src/pages/OptionsFlowScanner.tsx` | Replace static data with market data API calls. |
| `client/src/pages/SectorRotation.tsx` | Replace static sector data with `useMarketData('sectors')` hook. |
| `client/src/App.tsx` | Add auth check on mount (`GET /api/auth/me`). Wrap routes with auth guard. Show login page if unauthenticated. Remove hardcoded tester/tester123 check. |
| `.env` / `.env.example` | Add all new environment variables. |
| `tsconfig.json` | Ensure server code compiles (may need `tsconfig.server.json`). |

### Files to Remove (or Archive)

| File | Reason |
|------|--------|
| Hardcoded JSON data files (e.g., `portfolio.json`, `holdings.json`) | Replaced by per-user Plaid data. Optionally keep for a "demo mode." |
| SQLite database file (e.g., `*.db`, `*.sqlite`) | Replaced by PostgreSQL |

---

## 9. Cost Estimate

| Item | Cost | Notes |
|------|------|-------|
| **Railway Hobby** | $5/mo (includes $20 usage credit) | App + Postgres easily fit within credit |
| **Plaid (sandbox)** | $0 | Unlimited sandbox calls for development |
| **Plaid (production)** | ~$0 for first 200 calls; then varies | Investments is a subscription product (~$0.30–1.00/connected account/month at scale) |
| **Finnhub API** | $0 | Free tier: 60 calls/min — more than enough |
| **Alpha Vantage** (backup) | $0 | Free tier: 25 calls/day |
| **Domain** (optional) | ~$10-15/year | Railway provides `*.up.railway.app` for free |
| | | |
| **Total (development)** | **~$5/mo** | Railway only |
| **Total (production, <10 users)** | **~$5–10/mo** | Railway + minimal Plaid usage |
| **Total (production, ~50 users)** | **~$20–60/mo** | Railway + Plaid per-account fees |

---

## 10. Security Considerations

### 10.1 Encrypt Plaid Access Tokens at Rest

```typescript
// server/lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 10.2 Security Middleware

```typescript
// In server/index.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Security headers
app.use(helmet());

// CORS — restrict to your domain in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-app.up.railway.app'
    : 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  message: { error: 'Too many attempts, try again later' },
});
app.use('/api/auth', authLimiter);
```

```bash
npm install helmet express-rate-limit cors
```

### 10.3 Security Checklist

- [x] **HTTPS only** — Railway provides SSL automatically; set `cookie.secure: true` in production
- [x] **Encrypted tokens** — Plaid access_tokens encrypted with AES-256-GCM before DB storage
- [x] **Password hashing** — bcrypt with 12 salt rounds
- [x] **Rate limiting** — on `/api/auth/*` to prevent brute force
- [x] **httpOnly cookies** — session cookies not accessible via JavaScript
- [x] **Helmet.js** — sets security headers (X-Frame-Options, CSP, etc.)
- [x] **CORS** — restrict origins to your domain
- [x] **No secrets on frontend** — PLAID_SECRET, ENCRYPTION_KEY, DATABASE_URL are server-side only
- [x] **Session regeneration** — regenerate session ID on login to prevent fixation
- [x] **Input validation** — validate email format and password length on registration

---

## Quick Reference: New Dependencies

```bash
# Backend
npm install pg express-session connect-pg-simple bcrypt plaid node-cron helmet express-rate-limit cors

# Frontend
npm install react-plaid-link

# Dev
npm install -D @types/pg @types/express-session @types/bcrypt @types/node-cron @types/cors

# Remove
npm uninstall better-sqlite3
```

---

## Summary

This plan converts a single-user demo into a production multi-user app in 7 ordered steps. The critical path is: **Postgres → Auth → Plaid → Portfolio data → Market data → Frontend → Deploy**. Each step produces a testable intermediate state. Total cost at small scale is ~$5/month on Railway, with Plaid sandbox being free for development.
