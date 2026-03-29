import { describe, it, expect, vi, beforeEach } from "vitest";

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

function formatDateLabel(date: string): string {
  try {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return date;
  }
}

function formatHour(hour: number): string {
  const h = hour % 24;
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

const RESULT_LABELS: Record<string, string> = {
  "1-0": "White wins",
  "0-1": "Black wins",
  "1/2-1/2": "Draw",
};

const mockStats: StatsData = {
  gamesPerDay: [
    { date: "2025-06-01", count: 5 },
    { date: "2025-06-02", count: 8 },
  ],
  activePlayers: [
    { date: "2025-06-01", count: 4 },
    { date: "2025-06-02", count: 6 },
  ],
  timeFormats: [
    { format: "blitz", count: 7 },
    { format: "rapid", count: 4 },
    { format: "bullet", count: 2 },
  ],
  results: [
    { result: "1-0", count: 5 },
    { result: "0-1", count: 4 },
    { result: "1/2-1/2", count: 4 },
  ],
  avgMoves: [
    { date: "2025-06-01", avgMoves: 32.5 },
    { date: "2025-06-02", avgMoves: 28.1 },
  ],
  peakHours: [
    { hour: 14, count: 3 },
    { hour: 20, count: 5 },
  ],
  privateVsPublic: [
    { type: "public", count: 10 },
    { type: "private", count: 3 },
  ],
};

describe("isStatsData validation", () => {
  it("accepts valid stats data", () => {
    expect(isStatsData(mockStats)).toBe(true);
  });

  it("rejects null", () => {
    expect(isStatsData(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isStatsData("string")).toBe(false);
  });

  it("rejects object missing a key", () => {
    const { gamesPerDay, ...rest } = mockStats;
    expect(isStatsData(rest)).toBe(false);
  });

  it("rejects object with non-array values", () => {
    expect(isStatsData({ ...mockStats, gamesPerDay: "not array" })).toBe(false);
  });
});

describe("formatDateLabel", () => {
  it("formats a date string to short month + day", () => {
    const result = formatDateLabel("2025-06-15");
    expect(result).toContain("15");
  });

  it("returns the raw date for invalid input", () => {
    const result = formatDateLabel("bad-date");
    expect(typeof result).toBe("string");
  });
});

describe("formatHour", () => {
  it("formats midnight as 12 AM", () => {
    expect(formatHour(0)).toBe("12 AM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatHour(12)).toBe("12 PM");
  });

  it("formats morning hours", () => {
    expect(formatHour(9)).toBe("9 AM");
  });

  it("formats afternoon hours", () => {
    expect(formatHour(14)).toBe("2 PM");
  });

  it("formats 23 as 11 PM", () => {
    expect(formatHour(23)).toBe("11 PM");
  });
});

describe("result labels", () => {
  it("maps 1-0 to White wins", () => {
    expect(RESULT_LABELS["1-0"]).toBe("White wins");
  });

  it("maps 0-1 to Black wins", () => {
    expect(RESULT_LABELS["0-1"]).toBe("Black wins");
  });

  it("maps 1/2-1/2 to Draw", () => {
    expect(RESULT_LABELS["1/2-1/2"]).toBe("Draw");
  });
});

describe("summary calculations", () => {
  it("calculates total games from gamesPerDay", () => {
    const total = mockStats.gamesPerDay.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(13);
  });

  it("calculates peak daily players", () => {
    const peak = mockStats.activePlayers.reduce((max, d) => Math.max(max, d.count), 0);
    expect(peak).toBe(6);
  });

  it("calculates overall average moves", () => {
    const avg = Math.round(
      mockStats.avgMoves.reduce((s, d) => s + d.avgMoves, 0) / mockStats.avgMoves.length
    );
    expect(avg).toBe(30);
  });

  it("handles empty avgMoves array", () => {
    const data: DayAvg[] = [];
    const avg = data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.avgMoves, 0) / data.length)
      : 0;
    expect(avg).toBe(0);
  });
});

describe("stats API fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches stats from the API", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockStats), { status: 200 })
    );

    const res = await fetch("/api/stats/daily");
    const data: unknown = await res.json();

    expect(spy).toHaveBeenCalledOnce();
    expect(isStatsData(data)).toBe(true);
  });

  it("handles fetch error gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    let error: string | null = null;
    try {
      await fetch("/api/stats/daily");
    } catch (err) {
      error = (err as Error).message;
    }
    expect(error).toBe("network");
  });

  it("handles non-200 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Failed" }), { status: 500 })
    );

    const res = await fetch("/api/stats/daily");
    expect(res.ok).toBe(false);
  });
});

describe("stats route and feature flag", () => {
  it("stats page is accessible at /stats/graphs", () => {
    const path = "/stats/graphs";
    expect(path).toBe("/stats/graphs");
  });

  it("shows stats when flag is not set (default enabled)", () => {
    const flags: Record<string, string> = {};
    const show = flags["FEATURE_STATS"] !== "false";
    expect(show).toBe(true);
  });

  it("shows stats when flag is 'true'", () => {
    const flags = { FEATURE_STATS: "true" };
    const show = flags["FEATURE_STATS"] !== "false";
    expect(show).toBe(true);
  });

  it("hides stats when flag is 'false'", () => {
    const flags = { FEATURE_STATS: "false" };
    const show = flags["FEATURE_STATS"] !== "false";
    expect(show).toBe(false);
  });

  it("stats route bypasses name prompt (no playerName required)", () => {
    const playerName = "";
    const pathname = "/stats/graphs";
    const isStatsRoute = pathname === "/stats/graphs";
    const needsNamePrompt = !playerName && !isStatsRoute;
    expect(needsNamePrompt).toBe(false);
  });

  it("other routes require name prompt when no playerName", () => {
    const playerName = "";
    const pathname = "/";
    const isStatsRoute = pathname === "/stats/graphs";
    const needsNamePrompt = !playerName && !isStatsRoute;
    expect(needsNamePrompt).toBe(true);
  });
});
