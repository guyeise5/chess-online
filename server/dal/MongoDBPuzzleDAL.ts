import IPuzzleDAL, {Puzzle} from "./IPuzzleDAL";
import {MongoClient} from "mongodb";
import {toPuzzle} from "../utils";
import {mongoClient, mongodbPuzzlesCollectionName} from "../config";
import * as console from "console";

export class MongoDBPuzzleDAL implements IPuzzleDAL {
    private isConnectedPromise: Promise<void> | undefined = undefined
    private readonly client: MongoClient;
    private dbName: string;

    constructor(dbName: string) {
        this.client = mongoClient()
        this.dbName = dbName
    }

    close(): PromiseLike<void> {
        return this.client.close()
    }

    async getPuzzleById(puzzleId: string): Promise<Puzzle | undefined> {
        await this.connectIfNeeded()
        const document = await this.client.db(this.dbName)
            .collection(mongodbPuzzlesCollectionName)
            .find({puzzleId: puzzleId})
            .next()


        return toPuzzle(document)
    }

    async getPuzzleByRating(rating: number): Promise<Puzzle | undefined> {
        await this.connectIfNeeded()
        const document = await this.client.db(this.dbName)
            .collection(mongodbPuzzlesCollectionName)
            .aggregate([
                {$match: {rating: rating}},
                {$sample: {size: 1}}
            ]).next()

        return toPuzzle(document)
    }

    connectIfNeeded() {
        if (!this.isConnectedPromise) {
            this.isConnectedPromise = new Promise<void>((resolve) => {
                this.client.connect().then(() => resolve())
            }).then(() => console.log("connected to mongodb"))
        }
        return this.isConnectedPromise
    }

    async getAvailableRatings(): Promise<Set<number>> {
        await this.connectIfNeeded()
        const ratings = this.client
            .db(this.dbName)
            .collection(mongodbPuzzlesCollectionName)
            .distinct("rating");
        return new Set(await ratings
        )

    }
}
