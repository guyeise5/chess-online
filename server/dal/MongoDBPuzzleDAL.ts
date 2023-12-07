import IPuzzleDAL, {Puzzle} from "./IPuzzleDAL";
import {Collection} from "mongodb";
import {toPuzzle} from "../utils";
import {mongoClient, mongodbDbName, mongodbPuzzlesCollectionName} from "../config";

export class MongoDBPuzzleDAL implements IPuzzleDAL {

    async collection():Promise<Collection<Puzzle>> {
        return (await mongoClient()).db(mongodbDbName).collection(mongodbPuzzlesCollectionName)
    }
    async getPuzzleById(puzzleId: string): Promise<Puzzle | undefined> {
        const document = await (await this.collection())
            .find({puzzleId: puzzleId})
            .next()


        return toPuzzle(document)
    }

    async getPuzzleByRating(rating: number): Promise<Puzzle | undefined> {
        const document = await (await this.collection())
            .aggregate([
                {$match: {rating: rating}},
                {$sample: {size: 1}}
            ]).next()

        return toPuzzle(document)
    }


    async getAvailableRatings(): Promise<Set<number>> {
        const ratings = (await this.collection())
            .distinct("rating");
        return new Set(await ratings
        )

    }
}
