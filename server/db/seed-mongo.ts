import {MongoClient} from "mongodb";
import {mongodbConnectionString, mongodbDbName, mongodbPuzzlesCollectionName} from "../config";
import {InMemoryPuzzleDal} from "../dal/InMemoryPuzzleDal";
import {Puzzle} from "../dal/IPuzzleDAL";

async function seed() {
    if (!mongodbConnectionString) {
        console.error("mongodbConnectionString is empty")
        return
    }
    const client = new MongoClient(mongodbConnectionString)

    try {
        await client.connect()
        const puzzles = await new InMemoryPuzzleDal().puzzles
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