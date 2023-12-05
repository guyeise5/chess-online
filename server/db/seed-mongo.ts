import {MongoClient} from "mongodb";
import {mongodbConnectionString, mongodbDbName, mongodbPuzzlesCollectionName} from "../config";
import {Puzzle} from "../dal/IPuzzleDAL";
import {open} from "node:fs/promises";
import * as console from "console";
import {toPuzzle} from "../utils";
import path from 'path'

function convertToPuzzle(puzzleStr: string): Puzzle | null {
    const [PuzzleId,
        FEN,
        Moves,
        Rating,
        RatingDeviation,
        Popularity] = puzzleStr.split(",")
    const puzzle: Puzzle = {
        puzzleId: PuzzleId as string,
        fen: FEN as string,
        moves: Moves?.split(" ") as string[],
        rating: Number(Rating),
        ratingDeviation: Number(RatingDeviation),
        popularity: Number(Popularity)
    };

    return toPuzzle(puzzle) || null
}


async function getPuzzles() {
    const p = path.join(__dirname, './lichess_db_puzzle.csv');
    console.log("path", p)
    const file = await open(p)
    const puzzlesStr: string[] = []
    for await (const line of file.readLines()) {
        puzzlesStr.push(line)
    }
    return puzzlesStr
        .map(puzzleStr => convertToPuzzle(puzzleStr))
        .flatMap(p => p ? [p] : [])

}
async function seed() {
    if (!mongodbConnectionString) {
        console.error("mongodbConnectionString is empty")
        return
    }
    const client = new MongoClient(mongodbConnectionString)

    try {
        await client.connect()
        const puzzles = await getPuzzles()
        const collection = client.db(mongodbDbName).collection(mongodbPuzzlesCollectionName)
        await collection.createIndex({puzzleId: 1}, {unique: true})
        await collection.createIndex({rating: 1})

        let i = 0
        const slices: Puzzle[][] = []
        while (i < puzzles.length) {
            const s = i
            const e = Math.min(puzzles.length, i + 10000)
            slices.push(puzzles.slice(s, e))
            i = e
        }

        await Promise.all(
            slices.map(slice =>
                collection.insertMany(slice)
                    .then(() => console.log("inserted 10000 puzzles")))
        )
    } finally {
        await client.close()
    }
}

seed().then(() => console.log("success"))
    .catch(e => console.error(e))