import IPuzzleDAL, {Puzzle} from "./IPuzzleDAL";
import path from "path";
import {open} from "node:fs/promises";
import {toPuzzle} from "../utils";
import * as console from "console";

export class InMemoryPuzzleDal implements IPuzzleDAL {
    private readonly dbPath: string;
    public readonly puzzles: Promise<Puzzle[]>;
    private readonly puzzlesIdToIndex: Promise<Record<string, number>>
    private readonly puzzlesRatingToIndexes: Promise<Record<string, number[]>>

    constructor(dbPath?: string) {
        this.dbPath = dbPath || path.join(__dirname, "../db/lichess_db_puzzle.csv")
        this.puzzles = this.getPuzzles()
        this.puzzlesIdToIndex = this.puzzles
            .then(pzs => {
                const map: Record<string, number> = {}
                pzs.forEach((pz, idx) => map[pz.puzzleId] = idx)
                return map
            })

        this.puzzlesRatingToIndexes = this.puzzles
            .then(pzs => {
                const map: Record<string, number[]> = {}
                pzs.forEach((pz, idx) => {
                    if (!map[pz.rating]) {
                        map[pz.rating] = []
                    }
                    map[pz.rating].push(idx)
                })
                return map
            })
    }

    close(): PromiseLike<void> {
        return Promise.resolve();
    }

    async getPuzzleById(puzzleId: string): Promise<Puzzle | undefined> {
        const puzzles = await this.puzzles
        const idx = (await this.puzzlesIdToIndex)[puzzleId];
        return puzzles[idx]
    }

    async getPuzzleByRating(rating: number): Promise<Puzzle | undefined> {
        const puzzles = await this.puzzles
        const indices = (await this.puzzlesRatingToIndexes)[rating] || [];
        const randomIndex = Math.floor(Math.random() * indices.length)
        return puzzles[indices[randomIndex]]
    }


     async getPuzzles(): Promise<Puzzle[]> {
        const p = this.dbPath;
        console.log("path", p)
        const file = await open(p)
        const puzzlesStr: string[] = []
        for await (const line of file.readLines()) {
            puzzlesStr.push(line)
        }
        return puzzlesStr
            .map(puzzleStr => this.convertToPuzzle(puzzleStr))
            .flatMap(p => p ? [p] : [])
    }

    convertToPuzzle(puzzleStr: string): Puzzle | null {
        const [PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity] = puzzleStr.split(",")
        const puzzle: Puzzle = {
            puzzleId: PuzzleId,
            fen: FEN,
            moves: Moves?.split(" "),
            rating: Number(Rating),
            ratingDeviation: Number(RatingDeviation),
            popularity: Number(Popularity)
        };

        return toPuzzle(puzzle) || null
    }

    ratings: Set<number> | undefined = undefined
    async getAvailableRatings(): Promise<Set<number>> {
        if(!this.ratings) {
            const ratings = (await this.puzzles).map(p => p.rating);
            this.ratings = new Set(ratings)
        }

        return this.ratings

    }
}