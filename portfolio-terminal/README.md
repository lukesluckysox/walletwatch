# Portfolio Terminal

A Bloomberg-inspired multi-user portfolio dashboard with real brokerage integration via Plaid.

**4 Pages:**
- **Portfolio** — Login-gated view of holdings, equity curve, allocation, and performance
- **Should I Be Trading?** — Market quality score (VIX, SPY, trend, breadth, macro) → YES/NO
- **Options Flow Scanner** — Unusual options activity with filters and heatmaps
- **Sector Rotation** — 11 S&P 500 sector ETFs with quadrant map and relative strength

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Recharts, wouter
- **Backend:** Express 5, Drizzle ORM, PostgreSQL
- **Auth:** express-session + connect-pg-simple + bcrypt
- **Brokerage:** Plaid Investments API (holdings, transactions)
- **Market Data:** Finnhub API with server-side cron caching
- **Security:** helmet, rate-limiting, AES-256-GCM encrypted tokens

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or Docker)
- Plaid developer account ([dashboard.plaid.com](https://dashboard.plaid.com))
- Finnhub API key ([finnhub.io](https://finnhub.io))

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

If you don't have PostgreSQL locally, use Docker:

```bash
docker run -d \
  --name portfolio-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=dev \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=portfolio_terminal \
  postgres:16
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

| Variable | How to get it |
|----------|---------------|
| `DATABASE_URL` | `postgresql://dev:dev@localhost:5432/portfolio_terminal` (if using Docker above) |
| `SESSION_SECRET` | Run `openssl rand -hex 32` |
| `PLAID_CLIENT_ID` | From [Plaid Dashboard](https://dashboard.plaid.com) → Keys |
| `PLAID_SECRET` | From Plaid Dashboard → Keys (use Sandbox key for dev) |
| `PLAID_ENV` | `sandbox` for development |
| `ENCRYPTION_KEY` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FINNHUB_API_KEY` | From [finnhub.io](https://finnhub.io) → Free API Key |

### 4. Run database migrations

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000)

### 6. Test the flow

1. Visit the app → see login screen
2. Click "NEW USER? CREATE ACCOUNT" → register with email + password
3. After login, go to Portfolio page → click "LINK BROKERAGE"
4. In Plaid sandbox: use `user_good` / `pass_good` as test credentials
5. After linking, portfolio data will populate

---

## Deploy to Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/portfolio-terminal.git
git push -u origin main
```

### 2. Create Railway project

1. Go to [railway.com](https://railway.com) → New Project → Deploy from GitHub
2. Select your repository
3. Add PostgreSQL: click "New" → "Database" → "PostgreSQL"
4. Railway auto-injects `DATABASE_URL`

### 3. Set environment variables

In Railway dashboard → your service → Variables, add:

```
SESSION_SECRET=<generated value>
PLAID_CLIENT_ID=<your id>
PLAID_SECRET=<your production secret>
PLAID_ENV=production
ENCRYPTION_KEY=<generated value>
FINNHUB_API_KEY=<your key>
NODE_ENV=production
```

### 4. Configure build

Railway should auto-detect the Node.js project. If needed, set:
- **Build command:** `npm run build`
- **Start command:** `npm start`

### 5. Add a custom domain (optional)

Railway → Settings → Networking → Custom Domain

---

## Project Structure

```
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx              # Auth provider, router, sidebar
│       ├── components/
│       │   ├── PlaidLink.tsx    # Plaid Link widget button
│       │   └── ui/             # shadcn/ui components
│       ├── data/               # Static JSON (demo/fallback data)
│       ├── hooks/
│       │   ├── useAuth.ts      # Auth hook (standalone)
│       │   ├── useHoldings.ts  # Plaid holdings query
│       │   └── useMarketData.ts # Cached market data query
│       ├── lib/
│       │   └── queryClient.ts  # TanStack Query setup
│       └── pages/
│           ├── login.tsx       # Login + registration
│           ├── portfolio.tsx   # Portfolio dashboard
│           ├── trading.tsx     # Market quality assessment
│           ├── options.tsx     # Options flow scanner
│           └── sectors.tsx     # Sector rotation dashboard
├── server/
│   ├── index.ts               # Express app entry (middleware, startup)
│   ├── routes.ts              # Route registration
│   ├── db.ts                  # Drizzle + pg.Pool connection
│   ├── storage.ts             # (legacy stub)
│   ├── routes/
│   │   ├── auth.ts            # Register, login, logout, me
│   │   ├── plaid.ts           # Link token, exchange, holdings, refresh
│   │   └── market.ts          # Cached market data endpoints
│   ├── middleware/
│   │   ├── session.ts         # express-session + PostgreSQL store
│   │   └── requireAuth.ts     # Auth guard middleware
│   ├── lib/
│   │   ├── plaid.ts           # Plaid API client
│   │   └── encryption.ts      # AES-256-GCM for access tokens
│   ├── jobs/
│   │   └── marketData.ts      # Cron: refresh VIX/SPY/sectors every 15min
│   └── types/
│       └── express-session.d.ts # Session type augmentation
├── shared/
│   └── schema.ts              # Drizzle ORM schema (PostgreSQL)
├── drizzle.config.ts          # Drizzle Kit config
├── .env.example               # Environment variable template
└── package.json
```

---

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| Railway Hobby (app + Postgres) | ~$5 |
| Plaid sandbox (development) | Free |
| Plaid production (per connected account) | ~$0.30–1.00 |
| Finnhub free tier | Free |
| **Total (development)** | **~$5/mo** |
| **Total (< 10 users, production)** | **~$5–10/mo** |

---

## Plaid Sandbox Testing

In sandbox mode, use these test credentials in the Plaid Link widget:
- **Username:** `user_good`
- **Password:** `pass_good`
- **Institution:** Select any (e.g., "First Platypus Bank")

This creates test investment accounts with sample holdings.

---

## Notes

- **Static JSON fallback data** lives in `client/src/data/`. The current pages still import from these files. As you wire up the live API endpoints, replace the static imports with the hooks (`useHoldings`, `useMarketData`).
- **Options flow data** is simulated — no free real-time options API exists. Consider Polygon.io options API ($29/mo) for production.
- The **market data cron** runs every 15 minutes during US market hours (Mon–Fri 9:30–16:00 ET).
- **Sessions** are stored in PostgreSQL via `connect-pg-simple`. The table is auto-created.
