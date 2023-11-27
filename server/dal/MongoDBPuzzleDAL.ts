import IPuzzleDAL, {Puzzle} from "./IPuzzleDAL";
import {MongoClient} from "mongodb";
import {toPuzzle} from "../utils";
import {mongodbPuzzlesCollectionName} from "../config";

export class MongoDBPuzzleDAL implements IPuzzleDAL {
    private isConnectedPromise: Promise<void> | undefined = undefined
    private readonly client: MongoClient;
    private dbName: string;

    constructor(connectionString: string, dbName: string) {
        this.client = new MongoClient(connectionString, {
            readPreference: "secondaryPreferred"
        });
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
}
