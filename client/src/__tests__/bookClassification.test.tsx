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
    for (const l of [...this.listeners]) l(ev);
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
      queueMicrotask(() => {
        const spec = this.goHandler?.(this.lastPositionFen ?? "") ?? {
          cp: 0,
          best: "a2a3",
        };
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

describe("book move classification", () => {
  const OriginalWorker = globalThis.Worker;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          return new MockStockfishWorker() as unknown as Worker;
        }
      } as unknown as typeof Worker
    );

    (window as any).__ENV__ = { FEATURE_OPENING_BOOK: "true" };
  });

  afterEach(() => {
    vi.stubGlobal("Worker", OriginalWorker);
    MockStockfishWorker.lastInstance = null;
    fetchSpy?.mockRestore();
    delete (window as any).__ENV__;
  });

  it("classifies moves as 'book' when API confirms positions are in the book", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ book: [true, true, true] }),
    } as Response);

    const { root, ref } = mountHook(["e4", "e5"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: 30, best: "a2a3" });

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(
      () => {
        expect(ref.current!.analyzing).toBe(false);
        expect(ref.current!.evals).toHaveLength(3);
      },
      { timeout: 4000 }
    );

    expect(ref.current!.evals[0]!.classification).toBeUndefined();
    expect(ref.current!.evals[1]!.classification).toBe("book");
    expect(ref.current!.evals[2]!.classification).toBe("book");

    act(() => {
      root.unmount();
    });
  });

  it("switches from book to normal classification when a position leaves the book", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ book: [true, true, false] }),
    } as Response);

    const { root, ref } = mountHook(["e4", "e5"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: 30, best: "a2a3" });

    await flushMicrotasks();
    act(() => {
      ref.current!.startAnalysis();
    });
    await flushMicrotasks();

    await vi.waitFor(
      () => {
        expect(ref.current!.analyzing).toBe(false);
        expect(ref.current!.evals).toHaveLength(3);
      },
      { timeout: 4000 }
    );

    expect(ref.current!.evals[1]!.classification).toBe("book");
    expect(ref.current!.evals[2]!.classification).not.toBe("book");

    act(() => {
      root.unmount();
    });
  });

  it("falls back to normal classification when the book API fails", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const { root, ref } = mountHook(["e4"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: 30, best: "a2a3" });

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

    expect(ref.current!.evals[1]!.classification).not.toBe("book");

    act(() => {
      root.unmount();
    });
  });

  it("does not check book when feature flag is disabled", async () => {
    (window as any).__ENV__ = { FEATURE_OPENING_BOOK: "false" };
    fetchSpy = vi.spyOn(globalThis, "fetch");

    const { root, ref } = mountHook(["e4"]);
    const worker = MockStockfishWorker.lastInstance!;
    worker.goHandler = () => ({ cp: 30, best: "a2a3" });

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

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ref.current!.evals[1]!.classification).not.toBe("book");

    act(() => {
      root.unmount();
    });
  });
});
