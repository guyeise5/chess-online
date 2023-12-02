import {MongoManager} from "./MongoManager";
import {ObjectId, WithId} from "mongodb";
import {mongodbGamesCollectionName} from "../config";

export type GameDBObject = Readonly<WithId<{
    whitePlayerId: string
    blackPlayerId: string
    pgn: string
}>>

export type CreateGameOptions = {
    whitePlayerId: string
    blackPlayerId: string
    pgn: string
}

export class MongoGameManager extends MongoManager {

    public async getById(gameId: string): Promise<GameDBObject | null> {
        return this.collection().findOne({_id: new Object(gameId)})
    }


    public async create(options: CreateGameOptions): Promise<void> {
        await this.collection().insertOne({
            _id: new ObjectId(),
            whitePlayerId: options.whitePlayerId,
            blackPlayerId: options.blackPlayerId,
            pgn: options.pgn
        })
        return;
    }

    public async updatePgn(gameId: string, pgn: string) {
        await this.collection().updateOne({_id: new ObjectId(gameId)}, {pgn: pgn})
    }

    public async delete(gameId: string): Promise<void> {
        await this.collection().deleteOne({_id: new ObjectId(gameId)})
    }

    private collection() {
        return this.client.db(this.dbName).collection<GameDBObject>(mongodbGamesCollectionName)
    }
}