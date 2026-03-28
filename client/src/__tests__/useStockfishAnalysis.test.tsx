import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useStockfishAnalysis } from "../hooks/useStockfishAnalysis";

type GoResponse =
  | { cp: number; best: string }
  | { mate: number; best: string };

class MockStockfishWorker {
  static lastInstance: MockStockfishWorker | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  private listeners: Array<(e: MessageEvent) => void> = [];
  goHandler: ((fen: string) => GoResponse) | null = null;
  lastPositionFen: string | null = null;

  constructor() {
    MockStockfishWorker.lastInstance = this;
  }

  addEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn);
  }

  removeEventListener(_type: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  private emit(data: string) {
    const ev = { data } as MessageEvent;
    this.onmessage?.(ev);
    for (const l of [...this.listeners]) {
      l(ev);
    }
  }

  postMessage(msg: string) {
    if (msg === "uci") {
      queueMicrotask(() => this.emit("uciok"));
      return;
    }
    if (msg === "isready") {
      queueMicrotask(() => this.emit("readyok"));
      return;
    }
    if (msg.startsWith("position fen ")) {
      this.lastPositionFen = msg.slice("position fen ".length).trim();
      return;
    }
    if (msg.startsWith("go depth")) {
      const fen = this.lastPositionFen ?? "";
      queueMicrotask(() => {
        const spec = this.goHandler?.(fen) ?? { cp: 0, best: "a2a3" };
        if ("mate" in spec) {
          this.emit(`info depth 18 score mate ${spec.mate}`);
        } else {
          this.emit(`info depth 18 score cp ${spec.cp}`);
        }
        this.emit(`bestmove ${spec.best}`);
      });
      return;
    }
  }

  terminate() {
    this.listeners = [];
  }
}

function mountHook(moves: string[], startFen?: string) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const ref: { current: ReturnType<typeof useStockfishAnalysis> | null } = {
    current: null,
  };
  function Probe() {
    const api = useStockfishAnalysis(moves, startFen);
    ref.current = api;
    return null;
  }
  act(() => {
    root.render(<Probe />);
  });
  return { root, ref, container };
}

async function flushMicrotasks(times = 8) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe("useStockfishAnalysis", () => {
  const OriginalWorker = globalThis.Worker;

  beforeEach(() => {
    (window as any).__ENV__ = { FEATURE_OPENING_BOOK: "false" };
    vi.stubGlobal(
      "Worker",
      class {
        constructor(url: string | URL) {
          void url;
          return new MockStockfishWorker() as unknown as Worker;
        }
      } as unknown as typeof Worker
    );
  });

  afterEach(() => {
    vi.stubGlobal("Worker", OriginalWorker);
    MockStockfishWorker.lastInstance = null;
    delete (window as any).__ENV__;
  });

  it("runs UCI init, analyzes positions in order, and classifies centipawn loss from white's perspective", async () => {
    const { root, ref } = mountHook(["e4"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = (fen) => {
      if (fen.includes(" w ")) {
        return { cp: 100, best: "e2e4" };
      }
      return { cp: -50, best: "e7e5" };
    };

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(
      () => {
        expect(ref.current!.analyzing).toBe(false);
        expect(ref.current!.evals).toHaveLength(2);
      },
      { timeout: 4000 }
    );

    expect(ref.current!.evals).toHaveLength(2);
    expect(ref.current!.evals[0]!.classification).toBeUndefined();
    expect(ref.current!.evals[0]!.score).toBe(100);
    expect(ref.current!.evals[1]!.score).toBe(50);
    expect(ref.current!.evals[1]!.classification).toBe("best");
    expect(ref.current!.progress).toBe(100);

    act(() => {
      root.unmount();
    });
  });

  it("maps mate scores to large centipawn values (white to move: mate 3)", async () => {
    const { root, ref } = mountHook([]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ mate: 3, best: "e2e4" });

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(
      () => {
        expect(ref.current!.analyzing).toBe(false);
        expect(ref.current!.evals).toHaveLength(1);
      },
      { timeout: 4000 }
    );

    expect(ref.current!.evals[0]!.score).toBe(10000 - 3);

    act(() => {
      root.unmount();
    });
  });

  it("classifies a move as 'forced' when the previous position had exactly one legal move", async () => {
    const forcedFen = "K1k5/8/8/8/8/8/8/1r6 w - - 0 1";
    const { root, ref } = mountHook(["Ka7"], forcedFen);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: -900, best: "a8a7" });

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(
      () => {
        expect(ref.current!.analyzing).toBe(false);
        expect(ref.current!.evals).toHaveLength(2);
      },
      { timeout: 4000 }
    );

    expect(ref.current!.evals[1]!.classification).toBe("forced");

    act(() => {
      root.unmount();
    });
  });

  it("clears evals and stops analyzing when SAN replay fails", async () => {
    const { root, ref } = mountHook(["not-a-move"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: 0, best: "a2a3" });

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(() => {
      expect(ref.current!.analyzing).toBe(false);
    });

    expect(ref.current!.evals).toHaveLength(0);
    expect(ref.current!.progress).toBe(0);

    act(() => {
      root.unmount();
    });
  });
});
