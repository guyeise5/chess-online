import {createStockfish, Stockfish} from "./utills";
import {MinimalMove, toPromotion, toSquare} from "../game/utils";

export class Engine {
    private stockfish: Stockfish;
    public readonly onMessage: (callback: (data: MinimalMove) => void) => void;

    constructor() {
        this.stockfish = createStockfish()
        this.onMessage = (callback) => {
            this.stockfish?.addEventListener("message", (e) => {
                const bestMove: string = e.data?.match(/bestmove\s+(\S+)/)?.[1];
                const from = toSquare(bestMove?.substring(0,2))
                const to = toSquare(bestMove?.substring(2,4))
                const promotion = toPromotion(bestMove?.substring(4,5))
                if(!from || ! to) {
                    return
                }

                const stockfishMove = {
                    from: from,
                    to: to,
                    promotion: promotion
                };
                console.log("Stockfish move", stockfishMove)
                callback(stockfishMove);
            });
        };
        // Init engine
        this.stockfish?.postMessage("uci");
        this.stockfish?.postMessage("isready");
    }

    evaluatePosition(fen: string, depth: number) {
        this.stop()
        this.stockfish.postMessage(`position fen ${fen}`);
        this.stockfish.postMessage(`go depth ${depth}`);
    }

    stop() {
        this.stockfish.postMessage("stop"); // Run when changing positions
    }

    quit() {
        this.stockfish.postMessage("quit"); // Good to run this before unmounting.
    }
}