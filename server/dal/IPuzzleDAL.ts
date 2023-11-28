export type Puzzle = {
    puzzleId: string,
    fen: string,
    moves: string[],
    rating: number,
    ratingDeviation: number,
    popularity: number,
}
interface IPuzzleDAL {
    getPuzzleById(puzzleId: string): PromiseLike<Puzzle | undefined>
    getPuzzleByRating(rating: number): PromiseLike<Puzzle | undefined>
    close(): PromiseLike<void>
}

export default IPuzzleDAL