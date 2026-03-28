import { useState, useMemo } from "react";
import { useAuth } from "@/App";
import LoginPage from "./login";
import portfolioRaw from "@/data/portfolio.json";
import marketRaw from "@/data/market-indices.json";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const COLORS = ["#ffaa00", "#00ff88", "#4488ff", "#ff4444", "#00ccff", "#aa66ff"];

type LookbackPeriod = "1M" | "3M" | "6M" | "ALL";
type GainMode = "total" | "daily" | "5d" | "1m" | "6m";

const portfolio = portfolioRaw as any;
const market = marketRaw as any;

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function TickerBar() {
  const indices = [
    { label: "SPY", value: market.spy?.latest, change: market.spy?.daily_change },
    { label: "QQQ", value: market.qqq?.latest, change: market.qqq?.daily_change },
    { label: "VIX", value: market.vix?.latest, change: market.vix?.daily_change },
    { label: "10Y", value: market.tnx?.latest, change: market.tnx?.daily_change },
  ];
  const items = [...indices, ...indices]; // duplicate for seamless loop
  return (
    <div className="w-full overflow-hidden border-b border-[hsl(220,15%,14%)] bg-[hsl(220,20%,5%)]">
      <div className="ticker-animate flex whitespace-nowrap py-1.5 px-2">
        {items.map((idx, i) => (
          <span key={i} className="inline-flex items-center gap-2 mx-4 text-[10px] tabular-nums">
            <span className="text-[var(--terminal-dim)] font-semibold">{idx.label}</span>
            <span className="text-[hsl(60,5%,85%)]">{typeof idx.value === "number" ? idx.value.toFixed(2) : "—"}</span>
            <span className={idx.change >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}>
              {typeof idx.change === "number" ? formatPct(idx.change) : "—"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { isLoggedIn } = useAuth();
  const [lookback, setLookback] = useState<LookbackPeriod>("ALL");
  const [gainMode, setGainMode] = useState<GainMode>("total");

  const equityCurve = useMemo(() => {
    let data = portfolio.equityCurve || [];
    const now = new Date();
    if (lookback === "1M") data = data.filter((d: any) => new Date(d.date) >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
    else if (lookback === "3M") data = data.filter((d: any) => new Date(d.date) >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
    else if (lookback === "6M") data = data.filter((d: any) => new Date(d.date) >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()));
    return data;
  }, [lookback]);

  const sortedPositions = useMemo(() => {
    return [...(portfolio.positions || [])].sort((a: any, b: any) => b.value - a.value);
  }, []);

  const summary = portfolio.summary;

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  const getGainValue = (pos: any) => {
    switch (gainMode) {
      case "daily": return pos.dayChangePct ?? 0;
      case "5d": return pos.fiveDayChange ?? 0;
      case "1m": return pos.oneMonthChange ?? 0;
      case "6m": return pos.sixMonthChange ?? 0;
      default: return pos.gainLossPct ?? 0;
    }
  };

  const getGainLabel = () => {
    switch (gainMode) {
      case "daily": return "DAY";
      case "5d": return "5D";
      case "1m": return "1M";
      case "6m": return "6M";
      default: return "TOTAL";
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <TickerBar />

      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">PORTFOLIO OVERVIEW</div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold tabular-nums text-[hsl(60,5%,92%)]">{formatMoney(summary.totalValue)}</span>
            <span className={`text-sm tabular-nums font-semibold ${summary.totalGainLoss >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
              {summary.totalGainLoss >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(summary.totalGainLoss))} ({formatPct(summary.totalGainLossPct)})
            </span>
          </div>
          {summary.dayChange && (
            <div className={`text-[10px] tabular-nums mt-0.5 ${summary.dayChangePct >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
              TODAY: {formatMoney(summary.dayChange)} ({formatPct(summary.dayChangePct)})
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {/* Lookback selector */}
          <div>
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)] mb-1">LOOKBACK</div>
            <div className="flex border border-[hsl(220,15%,18%)] rounded overflow-hidden">
              {(["1M", "3M", "6M", "ALL"] as LookbackPeriod[]).map((p) => (
                <button
                  key={p}
                  data-testid={`button-lookback-${p.toLowerCase()}`}
                  onClick={() => setLookback(p)}
                  className={`px-2.5 py-1 text-[10px] font-medium tracking-wider transition-colors ${
                    lookback === p
                      ? "bg-[var(--terminal-amber)] text-[hsl(220,20%,6%)]"
                      : "text-[var(--terminal-dim)] hover:text-[hsl(60,5%,85%)] hover:bg-[hsl(220,15%,12%)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Gain/Loss dropdown */}
          <div>
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)] mb-1">GAIN/LOSS</div>
            <select
              data-testid="select-gain-mode"
              value={gainMode}
              onChange={(e) => setGainMode(e.target.value as GainMode)}
              className="bg-[hsl(220,20%,5%)] border border-[hsl(220,15%,18%)] rounded px-2.5 py-1 text-[10px] font-medium tracking-wider text-[hsl(60,5%,85%)] focus:outline-none focus:border-[var(--terminal-amber)]"
            >
              <option value="total">TOTAL G/L</option>
              <option value="daily">DAILY CHG</option>
              <option value="5d">5-DAY CHG</option>
              <option value="1m">1-MONTH CHG</option>
              <option value="6m">6-MONTH CHG</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Equity Curve */}
          <div className="col-span-2 border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">EQUITY CURVE</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--terminal-amber)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--terminal-amber)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#556677" }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}
                  labelStyle={{ color: "#556677" }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]}
                />
                <Area type="monotone" dataKey="portfolioValue" stroke="var(--terminal-amber)" fill="url(#curveGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="contributions" stroke="var(--terminal-dim)" strokeDasharray="4 4" fill="none" strokeWidth={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Allocation Pie */}
          <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">ALLOCATION</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={portfolio.allocations} dataKey="value" nameKey="bucket" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                  {portfolio.allocations.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
                  formatter={(v: number) => formatMoney(v)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {portfolio.allocations.slice(0, 4).map((a: any, i: number) => (
                <div key={a.bucket} className="flex items-center justify-between text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[i] }} />
                    <span className="text-[var(--terminal-dim)]">{a.bucket}</span>
                  </div>
                  <span className="tabular-nums text-[hsl(60,5%,80%)]">{formatMoney(a.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)]">
          <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">HOLDINGS · {sortedPositions.length} POSITIONS</div>
            <div className="text-[9px] tracking-wider text-[var(--terminal-dim)]">SHOWING: {getGainLabel()} CHANGE</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-[9px] tracking-widest text-[var(--terminal-dim)] border-b border-[hsl(220,15%,12%)]">
                  <th className="text-left px-4 py-2 font-medium">SYMBOL</th>
                  <th className="text-left px-3 py-2 font-medium">NAME</th>
                  <th className="text-left px-3 py-2 font-medium">SECTOR</th>
                  <th className="text-right px-3 py-2 font-medium">PRICE</th>
                  <th className="text-right px-3 py-2 font-medium">VALUE</th>
                  <th className="text-right px-3 py-2 font-medium">WEIGHT</th>
                  <th className="text-right px-3 py-2 font-medium">{getGainLabel()} %</th>
                  <th className="text-right px-4 py-2 font-medium">G/L $</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((pos: any) => {
                  const pctVal = getGainValue(pos);
                  const isPos = pctVal >= 0;
                  return (
                    <tr key={pos.symbol} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,15%,10%)] transition-colors" data-testid={`row-position-${pos.symbol}`}>
                      <td className="px-4 py-2 font-semibold text-[var(--terminal-amber)]">{pos.symbol}</td>
                      <td className="px-3 py-2 text-[hsl(60,5%,75%)] text-[10px] truncate max-w-[140px]">{pos.name}</td>
                      <td className="px-3 py-2 text-[var(--terminal-dim)] text-[10px]">{pos.sector}</td>
                      <td className="px-3 py-2 text-right text-[hsl(60,5%,82%)]">${pos.price?.toFixed(2) ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-[hsl(60,5%,88%)] font-medium">{formatMoney(pos.value)}</td>
                      <td className="px-3 py-2 text-right text-[var(--terminal-dim)]">{(pos.weight * 100).toFixed(1)}%</td>
                      <td className={`px-3 py-2 text-right font-semibold ${isPos ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {formatPct(pctVal)}
                      </td>
                      <td className={`px-4 py-2 text-right ${pos.gainLoss >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {pos.gainLoss >= 0 ? "+" : ""}{formatMoney(pos.gainLoss)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gain/Loss bar chart */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">{getGainLabel()} PERFORMANCE BY POSITION</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sortedPositions.map((p: any) => ({ symbol: p.symbol, pct: getGainValue(p) }))}>
              <XAxis dataKey="symbol" tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, getGainLabel()]}
              />
              <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
                {sortedPositions.map((p: any, i: number) => (
                  <Cell key={i} fill={getGainValue(p) >= 0 ? "var(--terminal-green)" : "var(--terminal-red)"} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
