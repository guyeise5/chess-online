import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { Chess } from "chess.js";
import useMultiPV, { type PVLine } from "../hooks/useMultiPV";

/* ------------------------------------------------------------------ */
/*  Mock Stockfish worker                                              */
/* ------------------------------------------------------------------ */

class MockWorker {
  static lastInstance: MockWorker | null = null;
  private listeners: Array<(e: MessageEvent) => void> = [];
  private positionFen: string | null = null;
  goResponder: ((fen: string) => string[]) | null = null;
  onStop: (() => void) | null = null;
  postMessageLog: string[] = [];

  constructor() {
    MockWorker.lastInstance = this;
  }

  addEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn);
  }
  removeEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  emit(data: string) {
    const ev = { data } as MessageEvent;
    for (const l of [...this.listeners]) l(ev);
  }
  postMessage(msg: string) {
    this.postMessageLog.push(msg);
    if (msg === "uci") {
      queueMicrotask(() => this.emit("uciok"));
      return;
    }
    if (msg.startsWith("setoption")) return;
    if (msg === "isready") {
      queueMicrotask(() => this.emit("readyok"));
      return;
    }
    if (msg.startsWith("position fen ")) {
      this.positionFen = msg.slice("position fen ".length).trim();
      return;
    }
    if (msg.startsWith("go depth")) {
      const fen = this.positionFen ?? "";
      queueMicrotask(() => {
        const lines = this.goResponder?.(fen) ?? [];
        for (const l of lines) this.emit(l);
      });
      return;
    }
    if (msg === "stop") {
      if (this.onStop) queueMicrotask(() => this.onStop!());
      return;
    }
    if (msg === "quit") return;
  }
  terminate() {
    this.listeners = [];
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Generate realistic multi-PV engine output for any legal position. */
function makePvResponse(
  fen: string,
  depth: number,
  maxPv = 5
): string[] {
  const g = new Chess(fen);
  const legalMoves = g.moves({ verbose: true });
  if (legalMoves.length === 0) return [];

  const pvCount = Math.min(maxPv, legalMoves.length);
  const lines: string[] = [];

  for (let pv = 1; pv <= pvCount; pv++) {
    const move = legalMoves[pv - 1];
    const uci = move.from + move.to + (move.promotion ?? "");
    const cp = 30 - pv * 10;
    lines.push(
      `info depth ${depth} seldepth ${depth + 2} multipv ${pv} ` +
        `score cp ${cp} nodes 50000 nps 500000 pv ${uci}`
    );
  }
  const best = legalMoves[0];
  lines.push(`bestmove ${best.from}${best.to}${best.promotion ?? ""}`);
  return lines;
}

/** Build an array of FENs for each half-move in a game. */
function gamePositions(moves: string[], startFen?: string): string[] {
  const g = new Chess(startFen);
  const fens = [g.fen()];
  for (const san of moves) {
    g.move(san);
    fens.push(g.fen());
  }
  return fens;
}

function mountHook(initialFen: string | null) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const ref: { current: { lines: PVLine[]; computing: boolean } | null } = {
    current: null,
  };
  let currentFen = initialFen;

  function Probe() {
    const api = useMultiPV(currentFen);
    ref.current = api;
    return null;
  }
  function render(fen: string | null) {
    currentFen = fen;
    act(() => root.render(<Probe />));
  }
  render(initialFen);
  return { root, ref, render };
}

async function flush(times = 12) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    vi.advanceTimersByTime(100);
    await flush();
  }
}

/* ------------------------------------------------------------------ */
/*  Test games                                                         */
/* ------------------------------------------------------------------ */

const SCHOLARS_MATE = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];

const ITALIAN_GAME = [
  "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5",
  "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+",
  "Nc3", "Nxe4", "O-O", "Bxc3", "bxc3", "d5",
  "Ba3",
];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("useMultiPV — full game simulation", () => {
  const OriginalWorker = globalThis.Worker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          return new MockWorker() as unknown as Worker;
        }
      } as unknown as typeof Worker
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("Worker", OriginalWorker);
    MockWorker.lastInstance = null;
  });

  /* ---- basic analysis ---- */

  it("produces lines for the starting position", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);

    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);
    expect(ref.current!.lines[0].depth).toBe(18);
    expect(ref.current!.lines[0].san.length).toBeGreaterThan(0);
    expect(ref.current!.lines[0].firstMove).not.toBeNull();

    act(() => root.unmount());
  });

  /* ---- navigate through every position ---- */

  it("navigates forward through every game position without getting stuck", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    let responseDepth = 18;
    worker.goResponder = (fen) => makePvResponse(fen, responseDepth);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    for (let i = 0; i < fens.length; i++) {
      render(fens[i]);
      await settle();

      const isGameOver = new Chess(fens[i]).isGameOver();
      if (isGameOver) {
        expect(ref.current!.lines).toHaveLength(0);
        expect(ref.current!.computing).toBe(false);
      } else {
        expect(ref.current!.lines.length).toBeGreaterThan(0);
        expect(ref.current!.computing).toBe(false);
        expect(ref.current!.lines[0].depth).toBe(responseDepth);
      }
    }

    act(() => root.unmount());
  });

  /* ---- checkmate clears lines ---- */

  it("clears lines and stops computing at checkmate", async () => {
    const fens = gamePositions(SCHOLARS_MATE);
    const checkmateFen = fens[fens.length - 1];

    expect(new Chess(checkmateFen).isCheckmate()).toBe(true);

    const { root, ref, render } = mountHook(fens[fens.length - 2]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    render(checkmateFen);
    await settle();

    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- rapid navigation (simulates holding arrow key) ---- */

  it("handles rapid position changes without getting stuck", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 14);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();

    for (let i = 1; i < Math.min(fens.length, 10); i++) {
      render(fens[i]);
      vi.advanceTimersByTime(30);
      await flush(3);
    }

    const finalFen = fens[Math.min(fens.length, 10) - 1];
    render(finalFen);
    await settle();

    if (!new Chess(finalFen).isGameOver()) {
      expect(ref.current!.lines.length).toBeGreaterThan(0);
      expect(ref.current!.computing).toBe(false);
    }

    act(() => root.unmount());
  });

  /* ---- stale bestmove from stop ---- */

  it("ignores stale bestmove after position change, then recovers", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 18);
    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    worker.onStop = () => {
      worker.emit("bestmove e2e4 ponder e7e5");
    };

    let blocked = true;
    const realResponder = worker.goResponder;
    worker.goResponder = (fen) => (blocked ? [] : realResponder(fen));

    render(fens[2]);
    vi.advanceTimersByTime(100);
    await flush();

    expect(ref.current!.computing).toBe(true);
    expect(ref.current!.lines).toHaveLength(0);

    blocked = false;
    worker.onStop = null;
    worker.goResponder = (fen) => makePvResponse(fen, 18);

    render(fens[4]);
    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- progressive depth ---- */

  it("displays progressive depths as engine deepens", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref } = mountHook(fens[4]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => {
      const g = new Chess(fen);
      const moves = g.moves({ verbose: true });
      if (moves.length === 0) return [];
      const lines: string[] = [];
      const pvCount = Math.min(5, moves.length);

      for (let d = 1; d <= 3; d++) {
        for (let pv = 1; pv <= pvCount; pv++) {
          const m = moves[pv - 1];
          const uci = m.from + m.to + (m.promotion ?? "");
          lines.push(
            `info depth ${d} multipv ${pv} score cp ${30 - pv * 5} pv ${uci}`
          );
        }
      }
      lines.push(
        `bestmove ${moves[0].from}${moves[0].to}${moves[0].promotion ?? ""}`
      );
      return lines;
    };

    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.lines[0].depth).toBe(3);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- fewer legal moves than NUM_PV ---- */

  it("handles position with fewer legal moves than NUM_PV", async () => {
    // King + pawn endgame position with limited moves
    const limitedFen = "8/8/8/8/8/5k2/6p1/6K1 w - - 0 1";
    const g = new Chess(limitedFen);
    const legalCount = g.moves().length;
    expect(legalCount).toBeLessThan(5);

    const { root, ref } = mountHook(limitedFen);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);

    await settle();

    expect(ref.current!.lines.length).toBe(legalCount);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- score flipping for black-to-move ---- */

  it("flips centipawn scores for black-to-move positions", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    // fens[1] is after 1.e4, black to move
    const blackFen = fens[1];
    expect(blackFen).toContain(" b ");

    const { root, ref } = mountHook(blackFen);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => {
      const g = new Chess(fen);
      const moves = g.moves({ verbose: true });
      const m = moves[0];
      const uci = m.from + m.to + (m.promotion ?? "");
      return [
        `info depth 18 multipv 1 score cp 50 pv ${uci}`,
        `bestmove ${uci}`,
      ];
    };

    await settle();

    expect(ref.current!.lines).toHaveLength(1);
    expect(ref.current!.lines[0].score).toBe(-50);

    act(() => root.unmount());
  });

  /* ---- mate score parsing ---- */

  it("parses mate scores correctly", async () => {
    // Position right before Scholar's Mate (Qh5 played, Nf6 played, white to move)
    const fens = gamePositions(SCHOLARS_MATE);
    const preMate = fens[fens.length - 2]; // before Qxf7#
    expect(preMate).toContain(" w ");

    const { root, ref } = mountHook(preMate);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = () => [
      "info depth 18 multipv 1 score mate 1 pv h5f7",
      "bestmove h5f7",
    ];

    await settle();

    expect(ref.current!.lines).toHaveLength(1);
    expect(ref.current!.lines[0].mate).toBe(1);
    expect(ref.current!.lines[0].score).toBeGreaterThan(9000);

    act(() => root.unmount());
  });

  /* ---- navigate backward then forward ---- */

  it("navigates backward then forward through a game without stuck lines", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[10]);
    const worker = MockWorker.lastInstance!;

    let callCount = 0;
    worker.goResponder = (fen) => {
      callCount++;
      return makePvResponse(fen, 18);
    };
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    // Navigate backward: 10 -> 5
    for (let i = 9; i >= 5; i--) {
      render(fens[i]);
      await settle();
    }

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    const linesAtPos5 = ref.current!.lines.map((l) => l.san[0]);

    // Navigate forward: 5 -> 10
    for (let i = 6; i <= 10; i++) {
      render(fens[i]);
      await settle();
    }

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    // Lines at position 10 should differ from position 5
    const linesAtPos10 = ref.current!.lines.map((l) => l.san[0]);
    expect(linesAtPos10).not.toEqual(linesAtPos5);

    act(() => root.unmount());
  });

  /* ---- null then valid fen ---- */

  it("transitions from null to valid fen correctly", async () => {
    const { root, ref, render } = mountHook(null);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);

    await settle();
    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(false);

    const fens = gamePositions(ITALIAN_GAME);
    render(fens[4]);
    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- valid fen then null then valid again ---- */

  it("recovers after fen goes null and comes back", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[3]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    render(null);
    await settle();
    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(false);

    render(fens[6]);
    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- info lines with extra UCI fields ---- */

  it("parses info lines that have extra UCI fields (nps, hashfull, tbhits)", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = () => [
      "info depth 18 seldepth 24 multipv 1 score cp 35 nodes 2345678 nps 1200000 hashfull 450 tbhits 0 time 1954 pv e2e4 e7e5 g1f3",
      "info depth 18 seldepth 22 multipv 2 score cp 25 nodes 2345678 nps 1200000 hashfull 450 tbhits 0 time 1954 pv d2d4 d7d5",
      "info depth 18 seldepth 20 multipv 3 score cp 15 nodes 2345678 nps 1200000 hashfull 450 tbhits 0 time 1954 pv g1f3 d7d5",
      "info depth 18 seldepth 18 multipv 4 score cp 10 nodes 2345678 nps 1200000 hashfull 450 tbhits 0 time 1954 pv c2c4 e7e5",
      "info depth 18 seldepth 16 multipv 5 score cp 5 nodes 2345678 nps 1200000 hashfull 450 tbhits 0 time 1954 pv b1c3 e7e5",
      "bestmove e2e4 ponder e7e5",
    ];

    await settle();

    expect(ref.current!.lines).toHaveLength(5);
    expect(ref.current!.lines[0].score).toBe(35);
    expect(ref.current!.lines[0].depth).toBe(18);
    expect(ref.current!.lines[0].san[0]).toBe("e4");

    act(() => root.unmount());
  });

  /* ---- info lines without pv field are skipped ---- */

  it("ignores info lines that lack a pv field", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = () => [
      "info depth 12 seldepth 12 nodes 50000 nps 500000 time 100",
      "info depth 12 multipv 1 score cp 30 pv e2e4 e7e5",
      "info depth 12 multipv 2 score cp 20 pv d2d4 d7d5",
      "info depth 12 multipv 3 score cp 10 pv g1f3 d7d5",
      "info depth 12 multipv 4 score cp 5 pv c2c4 e7e5",
      "info depth 12 multipv 5 score cp 0 pv b1c3 e7e5",
      "bestmove e2e4 ponder e7e5",
    ];

    await settle();

    expect(ref.current!.lines).toHaveLength(5);

    act(() => root.unmount());
  });

  /* ---- unmount during analysis doesn't crash ---- */

  it("unmounting during active analysis does not throw", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    let goCount = 0;
    worker.goResponder = (fen) => {
      goCount++;
      if (goCount === 1) return [];
      return makePvResponse(fen, 18);
    };

    await flush();
    vi.advanceTimersByTime(100);
    await flush();

    expect(ref.current!.computing).toBe(true);

    expect(() => {
      act(() => root.unmount());
    }).not.toThrow();
  });

  /* ---- Scholar's Mate full walkthrough ---- */

  it("walks through Scholar's Mate: every non-terminal position gets lines", async () => {
    const fens = gamePositions(SCHOLARS_MATE);
    const { root, ref, render } = mountHook(null);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 16);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    const results: { fen: string; lines: number; computing: boolean }[] = [];

    for (const fen of fens) {
      render(fen);
      await settle();

      results.push({
        fen,
        lines: ref.current!.lines.length,
        computing: ref.current!.computing,
      });
    }

    // Last position is checkmate → 0 lines, not computing
    const last = results[results.length - 1];
    expect(last.lines).toBe(0);
    expect(last.computing).toBe(false);

    // All other positions should have lines and not be stuck computing
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].lines).toBeGreaterThan(0);
      expect(results[i].computing).toBe(false);
    }

    act(() => root.unmount());
  });

  /* ---- lines clear immediately on fen change ---- */

  it("clears lines immediately when navigating mid-analysis, not after debounce", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    render(fens[4]);

    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(true);

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- stale info lines discarded after fen change ---- */

  it("discards in-flight engine output from old position after navigating", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => {
      const g = new Chess(fen);
      const moves = g.moves({ verbose: true });
      if (moves.length === 0) return [];
      const m = moves[0];
      const uci = m.from + m.to + (m.promotion ?? "");
      return [`info depth 5 multipv 1 score cp 20 pv ${uci}`];
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(true);

    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };
    render(fens[4]);

    expect(ref.current!.lines).toHaveLength(0);

    worker.emit("info depth 10 multipv 1 score cp 30 pv e2e4 e7e5");
    await flush();
    expect(ref.current!.lines).toHaveLength(0);

    worker.emit("bestmove e2e4");
    await flush();
    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(true);

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- no stale lines during debounce window ---- */

  it("does not show stale lines during the debounce period after navigation", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[2]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    render(fens[6]);

    expect(ref.current!.lines).toHaveLength(0);

    vi.advanceTimersByTime(30);
    await flush(3);

    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(true);

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- rapid navigation only analyzes final position ---- */

  it("rapid navigation within debounce window only sends go for the final position", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    worker.postMessageLog = [];

    for (let i = 1; i <= 8; i++) {
      render(fens[i]);
      vi.advanceTimersByTime(10);
      await flush(2);
    }

    await settle();

    const positionCmds = worker.postMessageLog.filter((m) =>
      m.startsWith("position fen ")
    );
    expect(positionCmds).toHaveLength(1);
    expect(positionCmds[0]).toContain(fens[8].split(" ")[0]);

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- same fen twice doesn't duplicate analysis ---- */

  it("re-rendering with the same fen does not restart analysis", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[3]);
    const worker = MockWorker.lastInstance!;

    let goCount = 0;
    worker.goResponder = (fen) => {
      goCount++;
      return makePvResponse(fen, 18);
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    const countAfterFirst = goCount;

    render(fens[3]);
    await settle();

    expect(goCount).toBe(countAfterFirst);

    act(() => root.unmount());
  });

  /* ---- stop is sent immediately on fen change ---- */

  it("sends stop to worker immediately when fen changes, before debounce", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    worker.postMessageLog = [];
    render(fens[4]);

    const stopBeforeDebounce = worker.postMessageLog.filter(
      (m) => m === "stop"
    );
    expect(stopBeforeDebounce.length).toBeGreaterThanOrEqual(1);

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- two quick presses while engine idle ---- */

  it("recovers after two quick presses when engine was idle", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    render(fens[2]);
    vi.advanceTimersByTime(20);
    await flush(2);
    render(fens[4]);

    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(true);

    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- two quick presses while engine is computing ---- */

  it("recovers after two quick presses while engine is still computing", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    let blocked = true;
    worker.goResponder = (fen) =>
      blocked ? [] : makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.computing).toBe(true);
    expect(ref.current!.lines).toHaveLength(0);

    render(fens[2]);
    vi.advanceTimersByTime(20);
    await flush(2);
    render(fens[4]);

    blocked = false;
    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- three presses: analyze fires between first two ---- */

  it("handles press → analyze fires → two quick presses → recovers", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;
    worker.goResponder = (fen) => makePvResponse(fen, 18);
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);

    render(fens[2]);
    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    render(fens[6]);
    vi.advanceTimersByTime(15);
    await flush(2);
    render(fens[8]);

    expect(ref.current!.lines).toHaveLength(0);
    expect(ref.current!.computing).toBe(true);

    await settle();

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });

  /* ---- only final position is analyzed after quick presses ---- */

  it("only analyzes the final position after two quick presses", async () => {
    const fens = gamePositions(ITALIAN_GAME);
    const { root, ref, render } = mountHook(fens[0]);
    const worker = MockWorker.lastInstance!;

    const analyzedFens: string[] = [];
    worker.goResponder = (fen) => {
      analyzedFens.push(fen);
      return makePvResponse(fen, 18);
    };
    worker.onStop = () => {
      worker.emit("bestmove a2a3");
    };

    await settle();
    expect(ref.current!.lines.length).toBeGreaterThan(0);
    analyzedFens.length = 0;

    render(fens[4]);
    vi.advanceTimersByTime(20);
    await flush(2);
    render(fens[8]);
    await settle();

    expect(analyzedFens).toHaveLength(1);
    expect(analyzedFens[0]).toBe(fens[8]);

    expect(ref.current!.lines.length).toBeGreaterThan(0);
    expect(ref.current!.computing).toBe(false);

    act(() => root.unmount());
  });
});
