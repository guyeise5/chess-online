import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import styles from "./StatsGraphs.module.css";

const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3001";

interface DayCount {
  date: string;
  count: number;
}

interface DayAvg {
  date: string;
  avgMoves: number;
}

interface FormatCount {
  format: string;
  count: number;
}

interface ResultCount {
  result: string;
  count: number;
}

interface HourCount {
  hour: number;
  count: number;
}

interface TypeCount {
  type: string;
  count: number;
}

interface StatsData {
  gamesPerDay: DayCount[];
  activePlayers: DayCount[];
  timeFormats: FormatCount[];
  results: ResultCount[];
  avgMoves: DayAvg[];
  peakHours: HourCount[];
  privateVsPublic: TypeCount[];
}

const PIE_COLORS = ["#629924", "#bf811d", "#4a90d9", "#b33430", "#8b5cf6", "#06b6d4"];
const RESULT_COLORS: Record<string, string> = {
  "1-0": "#629924",
  "0-1": "#b33430",
  "1/2-1/2": "#a0a0a0",
};
const RESULT_LABELS: Record<string, string> = {
  "1-0": "White wins",
  "0-1": "Black wins",
  "1/2-1/2": "Draw",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#302e2c",
    border: "1px solid #3d3935",
    borderRadius: 6,
    color: "#bababa",
    fontSize: 13,
  },
  itemStyle: { color: "#bababa" },
  labelStyle: { color: "#bababa" },
};

function formatDateLabel(date: unknown): string {
  const s = String(date ?? "");
  try {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function formatHour(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function isStatsData(data: unknown): data is StatsData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d["gamesPerDay"]) &&
    Array.isArray(d["activePlayers"]) &&
    Array.isArray(d["timeFormats"]) &&
    Array.isArray(d["results"]) &&
    Array.isArray(d["avgMoves"]) &&
    Array.isArray(d["peakHours"]) &&
    Array.isArray(d["privateVsPublic"])
  );
}

export default function StatsGraphs() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/stats/daily`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load statistics");
        return res.json();
      })
      .then((raw: unknown) => {
        if (cancelled) return;
        if (!isStatsData(raw)) {
          throw new Error("Invalid response shape");
        }
        setData(raw);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(typeof err?.message === "string" ? err.message : "Unknown error");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalGames =
    data?.gamesPerDay.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalPlayers =
    data?.activePlayers.reduce((max, d) => Math.max(max, d.count), 0) ?? 0;
  const overallAvgMoves =
    data && data.avgMoves.length > 0
      ? Math.round(
          data.avgMoves.reduce((s, d) => s + d.avgMoves, 0) / data.avgMoves.length
        )
      : 0;

  return (
    <div className={styles["container"]}>
      <header className={styles["header"]}>
        <span className={styles["headerIcon"]}>&#9814;</span>
        <h1 className={styles["headerTitle"]}>Server Statistics</h1>
        <span className={styles["headerSub"]}>
          Data from the last 7 days (room TTL window)
        </span>
      </header>

      {loading && <div className={styles["status"]}>Loading statistics...</div>}
      {error && (
        <div className={`${styles["status"]} ${styles["error"]}`}>{error}</div>
      )}

      {!loading && !error && data && (
        <div className={styles["main"]}>
          <div className={styles["summaryRow"]}>
            <div className={styles["summaryCard"]}>
              <span className={styles["summaryValue"]}>{totalGames}</span>
              <span className={styles["summaryLabel"]}>Total Games</span>
            </div>
            <div className={styles["summaryCard"]}>
              <span className={styles["summaryValue"]}>{totalPlayers}</span>
              <span className={styles["summaryLabel"]}>Peak Daily Players</span>
            </div>
            <div className={styles["summaryCard"]}>
              <span className={styles["summaryValue"]}>{overallAvgMoves}</span>
              <span className={styles["summaryLabel"]}>Avg Moves / Game</span>
            </div>
          </div>

          <div className={styles["grid"]}>
            {/* Games per day */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Games Per Day</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.gamesPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3935" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke="#787672"
                      fontSize={12}
                    />
                    <YAxis stroke="#787672" fontSize={12} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} labelFormatter={formatDateLabel} />
                    <Bar dataKey="count" name="Games" fill="#629924" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Active players per day */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Active Players Per Day</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.activePlayers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3935" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke="#787672"
                      fontSize={12}
                    />
                    <YAxis stroke="#787672" fontSize={12} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} labelFormatter={formatDateLabel} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Players"
                      stroke="#4a90d9"
                      strokeWidth={2}
                      dot={{ fill: "#4a90d9", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time format distribution */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Time Format Distribution</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.timeFormats}
                      dataKey="count"
                      nameKey="format"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: PieLabelRenderProps) => {
                        const payload = (props as unknown as Record<string, unknown>);
                        const fmt = String(payload["format"] ?? "");
                        const pct = Number(props.percent ?? 0);
                        return `${fmt} ${(pct * 100).toFixed(0)}%`;
                      }}
                      fontSize={12}
                    >
                      {data.timeFormats.map((_entry, i) => (
                        <Cell
                          key={`tf-${i}`}
                          fill={PIE_COLORS[i % PIE_COLORS.length] ?? "#629924"}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Result distribution */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Result Distribution</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.results.map((r) => ({
                        ...r,
                        label: RESULT_LABELS[r.result] ?? r.result,
                      }))}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: PieLabelRenderProps) => {
                        const payload = (props as unknown as Record<string, unknown>);
                        const lbl = String(payload["label"] ?? props.name ?? "");
                        const pct = Number(props.percent ?? 0);
                        return `${lbl} ${(pct * 100).toFixed(0)}%`;
                      }}
                      fontSize={12}
                    >
                      {data.results.map((entry) => (
                        <Cell
                          key={`r-${entry.result}`}
                          fill={RESULT_COLORS[entry.result] ?? "#787672"}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Average game length */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Avg Moves Per Game (Daily)</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.avgMoves}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3935" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      stroke="#787672"
                      fontSize={12}
                    />
                    <YAxis stroke="#787672" fontSize={12} />
                    <Tooltip {...TOOLTIP_STYLE} labelFormatter={formatDateLabel} />
                    <Line
                      type="monotone"
                      dataKey="avgMoves"
                      name="Avg Moves"
                      stroke="#bf811d"
                      strokeWidth={2}
                      dot={{ fill: "#bf811d", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak hours */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Peak Playing Hours (UTC)</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3d3935" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={formatHour}
                      stroke="#787672"
                      fontSize={11}
                    />
                    <YAxis stroke="#787672" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      labelFormatter={(h) =>
                        typeof h === "number" ? formatHour(h) : String(h)
                      }
                    />
                    <Bar dataKey="count" name="Games" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Private vs public */}
            <div className={styles["card"]}>
              <h3 className={styles["cardTitle"]}>Private vs Public Games</h3>
              <div className={styles["chartWrap"]}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.privateVsPublic}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      label={(props: PieLabelRenderProps) => {
                        const t = String(props.name ?? "");
                        const pct = Number(props.percent ?? 0);
                        return `${t} ${(pct * 100).toFixed(0)}%`;
                      }}
                      fontSize={12}
                    >
                      {data.privateVsPublic.map((entry) => (
                        <Cell
                          key={`pv-${entry.type}`}
                          fill={entry.type === "private" ? "#bf811d" : "#629924"}
                        />
                      ))}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
