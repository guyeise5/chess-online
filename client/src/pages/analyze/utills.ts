export type Stockfish = Worker
export function createStockfish(): Stockfish {
    return new Worker('./js/stockfish.js')
}