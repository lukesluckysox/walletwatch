import marketQuality from "@/data/market-quality.json";
import marketIndices from "@/data/market-indices.json";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const mq = marketQuality as any;
const mi = marketIndices as any;

function ScoreGauge({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const pct = (score / maxScore) * 100;
  const color = pct >= 65 ? "var(--terminal-green)" : pct >= 40 ? "var(--terminal-amber)" : "var(--terminal-red)";
  return (
    <div className="relative w-full h-2 bg-[hsl(220,15%,12%)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full animate-fill"
        style={{ "--fill-width": `${pct}%`, background: color } as any}
      />
    </div>
  );
}

function CategoryCard({ name, data }: { name: string; data: any }) {
  const color = data.score >= 65 ? "var(--terminal-green)" : data.score >= 40 ? "var(--terminal-amber)" : "var(--terminal-red)";
  const signalColor = data.signal === "LOW" || data.signal === "BULLISH" || data.signal === "BROAD" || data.signal === "STRONG" || data.signal === "ACCOMMODATIVE"
    ? "var(--terminal-green)"
    : data.signal === "MODERATE" || data.signal === "NEUTRAL" || data.signal === "MIXED" || data.signal === "POSITIVE"
    ? "var(--terminal-amber)"
    : "var(--terminal-red)";

  return (
    <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4" data-testid={`card-category-${name}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">{data.label}</div>
          <div className="text-[9px] tracking-wider text-[var(--terminal-dim)] mt-0.5">WEIGHT: {data.weight}%</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums" style={{ color }}>{data.score}</div>
          <div className="text-[10px] font-semibold tracking-wider" style={{ color: signalColor }}>{data.signal}</div>
        </div>
      </div>
      <ScoreGauge score={data.score} />
      <div className="mt-2 text-[9px] text-[var(--terminal-dim)]">{data.detail}</div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const config: Record<string, { color: string; bg: string; border: string; icon: string }> = {
    YES: { color: "var(--terminal-green)", bg: "rgba(0,255,136,0.08)", border: "rgba(0,255,136,0.25)", icon: "✓" },
    CAUTION: { color: "var(--terminal-amber)", bg: "rgba(255,170,0,0.08)", border: "rgba(255,170,0,0.25)", icon: "⚠" },
    NO: { color: "var(--terminal-red)", bg: "rgba(255,68,68,0.08)", border: "rgba(255,68,68,0.25)", icon: "✗" },
  };
  const c = config[decision] || config.CAUTION;

  return (
    <div
      data-testid="badge-decision"
      className="inline-flex items-center gap-3 px-6 py-3 rounded border"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
    >
      <span className="text-3xl">{c.icon}</span>
      <div>
        <div className="text-2xl font-bold tracking-wider">{decision}</div>
        <div className="text-[10px] tracking-widest opacity-70">
          {decision === "YES" ? "CONDITIONS FAVORABLE" : decision === "NO" ? "ELEVATED RISK" : "PROCEED WITH CAUTION"}
        </div>
      </div>
    </div>
  );
}

function MarketIndexCard({ label, data, historyKey }: { label: string; data: any; historyKey?: string }) {
  const history = historyKey ? (mi as any)[historyKey] || [] : [];
  const change = data?.daily_change ?? 0;
  const isPos = change >= 0;

  return (
    <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] tracking-widest text-[var(--terminal-dim)]">{label}</span>
        <span className={`text-[10px] tabular-nums font-semibold ${isPos ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
          {isPos ? "▲" : "▼"} {change.toFixed(2)}%
        </span>
      </div>
      <div className="text-lg font-bold tabular-nums text-[hsl(60,5%,90%)]">
        {label === "10Y YIELD" ? `${data?.latest?.toFixed(2)}%` : `$${data?.latest?.toFixed(2)}`}
      </div>
      {history.length > 2 && (
        <ResponsiveContainer width="100%" height={40}>
          <AreaChart data={history.slice(-30)}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPos ? "var(--terminal-green)" : "var(--terminal-red)"} stopOpacity={0.2} />
                <stop offset="95%" stopColor={isPos ? "var(--terminal-green)" : "var(--terminal-red)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="close" stroke={isPos ? "var(--terminal-green)" : "var(--terminal-red)"} fill={`url(#grad-${label})`} strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div className="flex gap-3 mt-1 text-[9px] tabular-nums text-[var(--terminal-dim)]">
        {data?.ma50 && <span>50MA: {label === "10Y YIELD" ? data.ma50.toFixed(2) : `$${data.ma50.toFixed(0)}`}</span>}
        {data?.ma200 && <span>200MA: {label === "10Y YIELD" ? data.ma200.toFixed(2) : `$${data.ma200.toFixed(0)}`}</span>}
      </div>
    </div>
  );
}

export default function TradingPage() {
  const categories = mq.categories || {};

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">MARKET QUALITY ASSESSMENT</div>
          <div className="text-lg font-bold text-[hsl(60,5%,92%)] mt-0.5">Should I Be Trading?</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)]">WEIGHTED SCORE</div>
            <div className="text-2xl font-bold tabular-nums" style={{
              color: mq.weighted_score >= 65 ? "var(--terminal-green)" : mq.weighted_score >= 40 ? "var(--terminal-amber)" : "var(--terminal-red)"
            }}>
              {mq.weighted_score}
            </div>
          </div>
          <DecisionBadge decision={mq.decision} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Market Index Cards */}
        <div className="grid grid-cols-4 gap-3">
          <MarketIndexCard label="S&P 500" data={mi.spy} historyKey="spy_history" />
          <MarketIndexCard label="NASDAQ 100" data={mi.qqq} historyKey="qqq_history" />
          <MarketIndexCard label="VIX" data={mi.vix} historyKey="vix_history" />
          <MarketIndexCard label="10Y YIELD" data={mi.tnx} />
        </div>

        {/* Score Categories */}
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(categories).map(([key, data]) => (
            <CategoryCard key={key} name={key} data={data} />
          ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)]">
          <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">SCORING METHODOLOGY</div>
          </div>
          <div className="p-4">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-[9px] tracking-widest text-[var(--terminal-dim)] border-b border-[hsl(220,15%,12%)]">
                  <th className="text-left px-3 py-2 font-medium">CATEGORY</th>
                  <th className="text-center px-3 py-2 font-medium">WEIGHT</th>
                  <th className="text-center px-3 py-2 font-medium">RAW SCORE</th>
                  <th className="text-center px-3 py-2 font-medium">WEIGHTED</th>
                  <th className="text-center px-3 py-2 font-medium">SIGNAL</th>
                  <th className="text-left px-3 py-2 font-medium">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(categories).map(([key, data]: [string, any]) => {
                  const weighted = (data.score * data.weight / 100).toFixed(1);
                  const color = data.score >= 65 ? "var(--terminal-green)" : data.score >= 40 ? "var(--terminal-amber)" : "var(--terminal-red)";
                  return (
                    <tr key={key} className="border-b border-[hsl(220,15%,10%)]">
                      <td className="px-3 py-2 text-[var(--terminal-amber)] font-semibold uppercase">{key}</td>
                      <td className="px-3 py-2 text-center text-[var(--terminal-dim)]">{data.weight}%</td>
                      <td className="px-3 py-2 text-center font-semibold" style={{ color }}>{data.score}</td>
                      <td className="px-3 py-2 text-center text-[hsl(60,5%,80%)]">{weighted}</td>
                      <td className="px-3 py-2 text-center font-semibold" style={{ color }}>{data.signal}</td>
                      <td className="px-3 py-2 text-[var(--terminal-dim)] text-[10px]">{data.detail}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[hsl(220,15%,18%)]">
                  <td className="px-3 py-2 font-bold text-[hsl(60,5%,90%)]">TOTAL</td>
                  <td className="px-3 py-2 text-center text-[var(--terminal-dim)]">100%</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-center font-bold text-lg" style={{
                    color: mq.weighted_score >= 65 ? "var(--terminal-green)" : mq.weighted_score >= 40 ? "var(--terminal-amber)" : "var(--terminal-red)"
                  }}>{mq.weighted_score}</td>
                  <td className="px-3 py-2 text-center font-bold" style={{
                    color: mq.decision === "YES" ? "var(--terminal-green)" : mq.decision === "NO" ? "var(--terminal-red)" : "var(--terminal-amber)"
                  }}>{mq.decision}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SPY 60-Day Chart */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">SPY 60-DAY PRICE ACTION</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mi.spy_history || []}>
              <defs>
                <linearGradient id="spyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--terminal-blue)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--terminal-blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#556677" }} tickFormatter={(d) => d.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, "SPY"]}
              />
              <Area type="monotone" dataKey="close" stroke="var(--terminal-blue)" fill="url(#spyGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
