import {Collection, ObjectId, WithId} from "mongodb";
import {mongoClient, mongodbDbName, mongodbGamesCollectionName} from "../config";
import {Chess, Color, WHITE} from "chess.js";

export type GameDBObject = Readonly<WithId<{
    sourceRoomId: string
    whitePlayerId: string
    blackPlayerId: string
    pgn: string
    currentPlayerToPlay: Color
    whitePlayerTimeSeconds: number
    blackPlayerTimeSeconds: number
    incSeconds: number
    over: boolean
}>>

export type CreateGameOptions = {
    sourceRoomId: string
    whitePlayerId: string
    blackPlayerId: string
    pgn: string
    timeMinutes: number,
    incSeconds: number

}

export class MongoGameManager {

    public async getByUserId(userId: string): Promise<GameDBObject[]> {
        return (await this.collection()).find({
            $or: [
                {whitePlayerId: userId},
                {blackPlayerId: userId}
            ]
        }).toArray()

    }
    public async getById(gameId: string): Promise<GameDBObject | null> {
        return (await this.collection()).findOne({_id: new ObjectId(gameId)}).catch(e => {
            console.log(e)
            return null
        })
    }


    public async create(options: CreateGameOptions): Promise<string> {
        return await (await this.collection()).insertOne({
            sourceRoomId: options.sourceRoomId,
            whitePlayerId: options.whitePlayerId,
            blackPlayerId: options.blackPlayerId,
            pgn: options.pgn,
            whitePlayerTimeSeconds: options.timeMinutes * 60,
            blackPlayerTimeSeconds: options.timeMinutes * 60,
            incSeconds: options.incSeconds,
            currentPlayerToPlay: WHITE,
            over: false
        }).then(r => r.insertedId.toString())
    }

    public async updatePgn(gameId: string, chess: Chess) {
        await (await this.collection()).updateOne(
            {_id: new ObjectId(gameId)},
            {
                $set: {
                    pgn: chess.pgn(),
                    currentPlayerToPlay: chess.turn(),
                    over: chess.isGameOver()
                }
            }
        ).then(x => console.log("update pgn", x))
    }

    public async incTime(gameId: string, color: Color): Promise<void> {
        let field: keyof GameDBObject = color === WHITE ? 'whitePlayerTimeSeconds' : 'blackPlayerTimeSeconds';
        const game = (await (await this.collection()).findOne({_id: new ObjectId(gameId)}))
        if (!game) {
            return
        }
        (await this.collection()).updateOne(
            {_id: new ObjectId(gameId)},
            {$inc: {[field]: game.incSeconds}}
        ).catch(e => console.error(e))
        // (await this.collection()).aggregate(pipeline)

    }

    public async delete(gameId: string): Promise<void> {
        console.log(`MOCK delete gameId: ${gameId}`)
        // await (await this.collection()).deleteOne({_id: new ObjectId(gameId)})
    }

    private async collection(): Promise<Collection<Omit<GameDBObject, "_id">>> {
        return (await mongoClient())
            .db(mongodbDbName)
            .collection(mongodbGamesCollectionName)
    }
}