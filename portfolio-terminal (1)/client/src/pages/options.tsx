import { useState, useMemo } from "react";
import optionsData from "@/data/options-flow.json";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const data = optionsData as any;

function formatPremium(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

type FlowFilter = "ALL" | "MEGA BLOCK" | "BLOCK" | "SWEEP" | "LARGE";
type SideFilter = "ALL" | "CALL" | "PUT";

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    "MEGA BLOCK": { bg: "rgba(255,68,68,0.12)", text: "var(--terminal-red)", border: "rgba(255,68,68,0.3)" },
    "BLOCK": { bg: "rgba(255,170,0,0.12)", text: "var(--terminal-amber)", border: "rgba(255,170,0,0.3)" },
    "SWEEP": { bg: "rgba(0,204,255,0.12)", text: "var(--terminal-cyan)", border: "rgba(0,204,255,0.3)" },
    "LARGE": { bg: "rgba(68,136,255,0.12)", text: "var(--terminal-blue)", border: "rgba(68,136,255,0.3)" },
  };
  const c = colors[category] || colors.LARGE;
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {category}
    </span>
  );
}

export default function OptionsPage() {
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("ALL");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");

  const filteredFlows = useMemo(() => {
    return (data.flows || []).filter((f: any) => {
      if (flowFilter !== "ALL" && f.category !== flowFilter) return false;
      if (sideFilter !== "ALL" && f.side !== sideFilter) return false;
      return true;
    });
  }, [flowFilter, sideFilter]);

  const summary = data.summary || {};

  // Heatmap data: premium by ticker and side
  const heatmapData = useMemo(() => {
    const map: Record<string, { calls: number; puts: number }> = {};
    (data.flows || []).forEach((f: any) => {
      if (!map[f.ticker]) map[f.ticker] = { calls: 0, puts: 0 };
      if (f.side === "CALL") map[f.ticker].calls += f.premium;
      else map[f.ticker].puts += f.premium;
    });
    return Object.entries(map)
      .map(([ticker, d]) => ({ ticker, calls: d.calls, puts: d.puts, total: d.calls + d.puts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, []);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">UNUSUAL OPTIONS ACTIVITY</div>
          <div className="text-lg font-bold text-[hsl(60,5%,92%)] mt-0.5">Options Flow Scanner</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)]">TOTAL PREMIUM</div>
            <div className="text-xl font-bold tabular-nums text-[var(--terminal-amber)]">{formatPremium(summary.total_premium)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-widest text-[var(--terminal-dim)]">P/C RATIO</div>
            <div className={`text-xl font-bold tabular-nums ${summary.put_call_ratio > 1 ? "text-[var(--terminal-red)]" : "text-[var(--terminal-green)]"}`}>
              {summary.put_call_ratio}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "CALL PREMIUM", value: formatPremium(summary.call_premium), color: "var(--terminal-green)" },
            { label: "PUT PREMIUM", value: formatPremium(summary.put_premium), color: "var(--terminal-red)" },
            { label: "MEGA BLOCKS", value: summary.mega_blocks, color: "var(--terminal-red)" },
            { label: "BLOCKS", value: summary.blocks, color: "var(--terminal-amber)" },
            { label: "SWEEPS", value: summary.sweeps, color: "var(--terminal-cyan)" },
            { label: "LARGE", value: summary.large, color: "var(--terminal-blue)" },
          ].map((kpi) => (
            <div key={kpi.label} className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-3">
              <div className="text-[9px] tracking-widest text-[var(--terminal-dim)]">{kpi.label}</div>
              <div className="text-lg font-bold tabular-nums mt-1" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Net Flow Bar Chart */}
          <div className="col-span-2 border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">NET FLOW BY TICKER (CALLS - PUTS)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(data.ticker_net_flows || []).slice(0, 12)}>
                <XAxis dataKey="ticker" tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatPremium(Math.abs(v))} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
                  formatter={(v: number) => [formatPremium(Math.abs(v)), v >= 0 ? "Bullish" : "Bearish"]}
                />
                <Bar dataKey="net" radius={[2, 2, 0, 0]}>
                  {(data.ticker_net_flows || []).slice(0, 12).map((item: any, i: number) => (
                    <Cell key={i} fill={item.net >= 0 ? "var(--terminal-green)" : "var(--terminal-red)"} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 Convictions */}
          <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)]">
            <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)]">
              <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">TOP 5 CONVICTIONS</div>
            </div>
            <div className="p-3 space-y-2">
              {(data.top_convictions || []).map((conv: any, i: number) => (
                <div key={conv.ticker} className="flex items-center gap-3 p-2 rounded bg-[hsl(220,15%,7%)]" data-testid={`card-conviction-${conv.ticker}`}>
                  <span className="text-[10px] font-bold text-[var(--terminal-dim)] w-4">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[var(--terminal-amber)]">{conv.ticker}</span>
                      <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        conv.bias === "BULLISH" ? "bg-[rgba(0,255,136,0.1)] text-[var(--terminal-green)]" : "bg-[rgba(255,68,68,0.1)] text-[var(--terminal-red)]"
                      }`}>{conv.bias}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[9px] tabular-nums text-[var(--terminal-dim)]">
                      <span>C: {formatPremium(conv.call_premium)}</span>
                      <span>P: {formatPremium(conv.put_premium)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold tabular-nums text-[hsl(60,5%,88%)]">{formatPremium(conv.net_premium)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flow Heatmap */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">FLOW HEATMAP · TOP TICKERS</div>
          <div className="grid grid-cols-12 gap-1">
            {heatmapData.map((item) => {
              const maxPrem = Math.max(...heatmapData.map((d) => d.total));
              const intensity = item.total / maxPrem;
              const callBias = item.calls / (item.calls + item.puts);
              const color = callBias > 0.6 ? `rgba(0,255,136,${0.15 + intensity * 0.5})` : callBias < 0.4 ? `rgba(255,68,68,${0.15 + intensity * 0.5})` : `rgba(255,170,0,${0.15 + intensity * 0.5})`;
              return (
                <div key={item.ticker} className="aspect-square flex flex-col items-center justify-center rounded border border-[hsl(220,15%,14%)]" style={{ background: color }}>
                  <div className="text-[10px] font-bold text-[hsl(60,5%,90%)]">{item.ticker}</div>
                  <div className="text-[8px] tabular-nums text-[hsl(60,5%,70%)]">{formatPremium(item.total)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flow Table with Filters */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)]">
          <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">LIVE FLOW · {filteredFlows.length} ENTRIES</div>
            <div className="flex gap-2">
              {/* Category filter */}
              <div className="flex border border-[hsl(220,15%,18%)] rounded overflow-hidden">
                {(["ALL", "MEGA BLOCK", "BLOCK", "SWEEP", "LARGE"] as FlowFilter[]).map((f) => (
                  <button
                    key={f}
                    data-testid={`button-filter-${f.toLowerCase().replace(' ', '-')}`}
                    onClick={() => setFlowFilter(f)}
                    className={`px-2 py-1 text-[9px] tracking-wider transition-colors ${
                      flowFilter === f ? "bg-[var(--terminal-amber)] text-[hsl(220,20%,6%)] font-bold" : "text-[var(--terminal-dim)] hover:text-[hsl(60,5%,85%)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Side filter */}
              <div className="flex border border-[hsl(220,15%,18%)] rounded overflow-hidden">
                {(["ALL", "CALL", "PUT"] as SideFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSideFilter(f)}
                    className={`px-2.5 py-1 text-[9px] tracking-wider transition-colors ${
                      sideFilter === f ? "bg-[var(--terminal-amber)] text-[hsl(220,20%,6%)] font-bold" : "text-[var(--terminal-dim)] hover:text-[hsl(60,5%,85%)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-[11px] tabular-nums">
              <thead className="sticky top-0 bg-[hsl(220,18%,9%)] z-10">
                <tr className="text-[9px] tracking-widest text-[var(--terminal-dim)] border-b border-[hsl(220,15%,12%)]">
                  <th className="text-left px-4 py-2 font-medium">TIME</th>
                  <th className="text-left px-3 py-2 font-medium">TICKER</th>
                  <th className="text-center px-3 py-2 font-medium">SIDE</th>
                  <th className="text-right px-3 py-2 font-medium">STRIKE</th>
                  <th className="text-center px-3 py-2 font-medium">EXP</th>
                  <th className="text-right px-3 py-2 font-medium">PREMIUM</th>
                  <th className="text-center px-3 py-2 font-medium">TYPE</th>
                  <th className="text-center px-3 py-2 font-medium">SENTIMENT</th>
                  <th className="text-right px-3 py-2 font-medium">VOL</th>
                  <th className="text-right px-4 py-2 font-medium">OI</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.slice(0, 50).map((flow: any) => (
                  <tr key={flow.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,15%,10%)] transition-colors" data-testid={`row-flow-${flow.id}`}>
                    <td className="px-4 py-1.5 text-[var(--terminal-dim)]">{flow.time}</td>
                    <td className="px-3 py-1.5 font-semibold text-[var(--terminal-amber)]">{flow.ticker}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`font-semibold ${flow.side === "CALL" ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>{flow.side}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[hsl(60,5%,80%)]">${flow.strike}</td>
                    <td className="px-3 py-1.5 text-center text-[var(--terminal-dim)]">{flow.expiry}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-[hsl(60,5%,90%)]">{formatPremium(flow.premium)}</td>
                    <td className="px-3 py-1.5 text-center"><CategoryBadge category={flow.category} /></td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`text-[9px] font-bold tracking-wider ${flow.sentiment === "BULLISH" ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {flow.sentiment}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[var(--terminal-dim)]">{flow.volume.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-right text-[var(--terminal-dim)]">{flow.oi.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
