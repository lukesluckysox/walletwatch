import { useState, useMemo } from "react";
import sectorData from "@/data/sector-rotation.json";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid
} from "recharts";

const sectors = sectorData as any[];

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type ReturnPeriod = "5d" | "1m" | "6m";

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 20;
  const w = 64;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function QuadrantLabel({ label, x, y, color }: { label: string; x: string; y: string; color: string }) {
  return (
    <div className={`absolute ${x} ${y} text-[9px] font-bold tracking-widest`} style={{ color }}>
      {label}
    </div>
  );
}

function RotationQuadrantMap() {
  // Map sectors to scatter data
  const scatterData = sectors.map((s) => ({
    x: s.relative_strength["1m"],
    y: s.relative_strength["6m"],
    name: s.ticker,
    fullName: s.name,
    quadrant: s.quadrant,
  }));

  const quadrantColors: Record<string, string> = {
    LEADING: "var(--terminal-green)",
    IMPROVING: "var(--terminal-cyan)",
    WEAKENING: "var(--terminal-amber)",
    LAGGING: "var(--terminal-red)",
  };

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,14%)" />
          <XAxis
            type="number"
            dataKey="x"
            name="1M Relative"
            tick={{ fontSize: 9, fill: "#556677" }}
            axisLine={{ stroke: "hsl(220,15%,20%)" }}
            tickLine={false}
            label={{ value: "1M RELATIVE STRENGTH →", position: "insideBottom", offset: -15, fontSize: 9, fill: "#556677" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="6M Relative"
            tick={{ fontSize: 9, fill: "#556677" }}
            axisLine={{ stroke: "hsl(220,15%,20%)" }}
            tickLine={false}
            label={{ value: "6M RELATIVE →", angle: -90, position: "insideLeft", offset: 5, fontSize: 9, fill: "#556677" }}
          />
          <ZAxis range={[120, 120]} />
          <Tooltip
            contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
            formatter={(v: number, name: string) => [`${v.toFixed(2)}%`, name === "x" ? "1M Rel" : "6M Rel"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ? `${payload[0].payload.name} (${payload[0].payload.fullName})` : ""}
          />
          {/* Reference lines at 0,0 */}
          <Scatter data={scatterData} shape={(props: any) => {
            const d = props.payload;
            const color = quadrantColors[d.quadrant] || "var(--terminal-dim)";
            return (
              <g>
                <circle cx={props.cx} cy={props.cy} r={16} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} />
                <text x={props.cx} y={props.cy + 3} textAnchor="middle" fill={color} fontSize={8} fontWeight={700} fontFamily="var(--font-mono)">
                  {d.name}
                </text>
              </g>
            );
          }} />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant labels overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <QuadrantLabel label="LEADING ↗" x="right-6" y="top-2" color="var(--terminal-green)" />
        <QuadrantLabel label="IMPROVING ↑" x="left-6" y="top-2" color="var(--terminal-cyan)" />
        <QuadrantLabel label="WEAKENING ↓" x="right-6" y="bottom-8" color="var(--terminal-amber)" />
        <QuadrantLabel label="LAGGING ↙" x="left-6" y="bottom-8" color="var(--terminal-red)" />
      </div>
    </div>
  );
}

function EconomicCycleOverlay() {
  const phases = [
    { name: "RECESSION", sectors: ["Consumer Staples", "Utilities"], color: "var(--terminal-red)" },
    { name: "EARLY RECOVERY", sectors: ["Financials", "Consumer Disc.", "Real Estate"], color: "var(--terminal-cyan)" },
    { name: "MID CYCLE", sectors: ["Materials", "Comm. Services"], color: "var(--terminal-green)" },
    { name: "LATE EXPANSION", sectors: ["Technology"], color: "var(--terminal-amber)" },
    { name: "LATE CYCLE", sectors: ["Energy"], color: "var(--terminal-red)" },
    { name: "DEFENSIVE", sectors: ["Health Care"], color: "var(--terminal-blue)" },
    { name: "EARLY EXPANSION", sectors: ["Industrials"], color: "var(--terminal-green)" },
  ];

  return (
    <div className="space-y-2">
      {phases.map((phase) => (
        <div key={phase.name} className="flex items-center gap-3">
          <div className="w-28 text-[9px] font-bold tracking-wider" style={{ color: phase.color }}>{phase.name}</div>
          <div className="flex-1 flex gap-1 flex-wrap">
            {phase.sectors.map((sectorName) => {
              const s = sectors.find((sec) => sec.name === sectorName);
              if (!s) return null;
              const perf = s.returns["1m"];
              return (
                <span key={sectorName} className="px-2 py-1 rounded text-[9px] font-medium border border-[hsl(220,15%,14%)] bg-[hsl(220,15%,8%)]">
                  <span className="text-[var(--terminal-amber)]">{s.ticker}</span>
                  <span className={`ml-1.5 tabular-nums ${perf >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                    {formatPct(perf)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SectorPage() {
  const [period, setPeriod] = useState<ReturnPeriod>("1m");

  const sortedSectors = useMemo(() => {
    return [...sectors].sort((a, b) => b.returns[period] - a.returns[period]);
  }, [period]);

  const perfBarData = useMemo(() => {
    return sortedSectors.map((s) => ({
      ticker: s.ticker,
      name: s.name,
      return: s.returns[period],
    }));
  }, [sortedSectors, period]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-[hsl(220,15%,14%)] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">S&P 500 SECTOR ANALYSIS</div>
          <div className="text-lg font-bold text-[hsl(60,5%,92%)] mt-0.5">Sector Rotation Dashboard</div>
        </div>
        <div>
          <div className="text-[9px] tracking-widest text-[var(--terminal-dim)] mb-1">PERIOD</div>
          <div className="flex border border-[hsl(220,15%,18%)] rounded overflow-hidden">
            {(["5d", "1m", "6m"] as ReturnPeriod[]).map((p) => (
              <button
                key={p}
                data-testid={`button-period-${p}`}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-[10px] font-medium tracking-wider transition-colors ${
                  period === p ? "bg-[var(--terminal-amber)] text-[hsl(220,20%,6%)]" : "text-[var(--terminal-dim)] hover:text-[hsl(60,5%,85%)]"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Performance Heatmap */}
          <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">SECTOR PERFORMANCE ({period.toUpperCase()})</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perfBarData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9, fill: "#556677" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="ticker" tick={{ fontSize: 10, fill: "#ffaa00", fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "hsl(220,18%,10%)", border: "1px solid hsl(220,15%,18%)", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, period.toUpperCase()]}
                  labelFormatter={(label) => {
                    const s = sectors.find((sec) => sec.ticker === label);
                    return s ? `${s.ticker} — ${s.name}` : label;
                  }}
                />
                <Bar dataKey="return" radius={[0, 3, 3, 0]}>
                  {perfBarData.map((item, i) => (
                    <Cell key={i} fill={item.return >= 0 ? "var(--terminal-green)" : "var(--terminal-red)"} fillOpacity={0.65} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rotation Quadrant Map */}
          <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">ROTATION QUADRANT MAP</div>
            <RotationQuadrantMap />
          </div>
        </div>

        {/* Relative Strength Ranking Table */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)]">
          <div className="px-4 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <div className="text-[10px] tracking-widest text-[var(--terminal-dim)]">RELATIVE STRENGTH RANKING</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-[9px] tracking-widest text-[var(--terminal-dim)] border-b border-[hsl(220,15%,12%)]">
                  <th className="text-left px-4 py-2 font-medium">RANK</th>
                  <th className="text-left px-3 py-2 font-medium">SECTOR</th>
                  <th className="text-left px-3 py-2 font-medium">ETF</th>
                  <th className="text-right px-3 py-2 font-medium">PRICE</th>
                  <th className="text-right px-3 py-2 font-medium">5D</th>
                  <th className="text-right px-3 py-2 font-medium">1M</th>
                  <th className="text-right px-3 py-2 font-medium">6M</th>
                  <th className="text-right px-3 py-2 font-medium">REL 1M</th>
                  <th className="text-center px-3 py-2 font-medium">QUADRANT</th>
                  <th className="text-center px-3 py-2 font-medium">CYCLE</th>
                  <th className="text-center px-4 py-2 font-medium">TREND</th>
                </tr>
              </thead>
              <tbody>
                {sortedSectors.map((s, i) => {
                  const quadColors: Record<string, string> = {
                    LEADING: "var(--terminal-green)", IMPROVING: "var(--terminal-cyan)",
                    WEAKENING: "var(--terminal-amber)", LAGGING: "var(--terminal-red)",
                  };
                  return (
                    <tr key={s.ticker} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,15%,10%)] transition-colors" data-testid={`row-sector-${s.ticker}`}>
                      <td className="px-4 py-2 text-[var(--terminal-dim)] font-bold">#{i + 1}</td>
                      <td className="px-3 py-2 text-[hsl(60,5%,85%)]">{s.name}</td>
                      <td className="px-3 py-2 font-semibold text-[var(--terminal-amber)]">{s.ticker}</td>
                      <td className="px-3 py-2 text-right text-[hsl(60,5%,82%)]">${s.price.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right ${s.returns["5d"] >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {formatPct(s.returns["5d"])}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${s.returns["1m"] >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {formatPct(s.returns["1m"])}
                      </td>
                      <td className={`px-3 py-2 text-right ${s.returns["6m"] >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {formatPct(s.returns["6m"])}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${s.relative_strength["1m"] >= 0 ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}`}>
                        {formatPct(s.relative_strength["1m"])}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[9px] font-bold tracking-wider" style={{ color: quadColors[s.quadrant] }}>{s.quadrant}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-[9px] text-[var(--terminal-dim)]">{s.cycle_phase}</td>
                      <td className="px-4 py-2 text-center">
                        <MiniSparkline
                          data={s.sparkline}
                          color={s.returns["1m"] >= 0 ? "var(--terminal-green)" : "var(--terminal-red)"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Economic Cycle Overlay */}
        <div className="border border-[hsl(220,15%,14%)] rounded bg-[hsl(220,18%,8%)] p-4">
          <div className="text-[10px] tracking-widest text-[var(--terminal-dim)] mb-3">ECONOMIC CYCLE MAPPING</div>
          <EconomicCycleOverlay />
        </div>
      </div>
    </div>
  );
}
