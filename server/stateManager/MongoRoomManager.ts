import {Collection, ObjectId, WithId} from "mongodb";
import {mongoClient, mongodbDbName, mongodbRoomsCollectionName} from "../config";
import {Color} from "chess.js";

export type RoomDBObject = Readonly<WithId<{
    name: string | null
    userId: string
    color: Color | "random"
    hidden: boolean
    timeMinutes: number
    incrementSeconds: number
}>>

export type CreateRoomOptions = {
    selectedColor: Color | "random"
    minutesPerSide: number
    incrementPerSide: number
    hidden: boolean,
    name: string
}

export class MongoRoomManager {
    private dbName: string

    constructor() {
        this.dbName = mongodbDbName
    }

    private async collection(): Promise<Collection<Omit<RoomDBObject, "_id">>> {
        return (await mongoClient())
            .db(this.dbName)
            .collection(mongodbRoomsCollectionName)
    }

    public async getAvailable(userId: string): Promise<RoomDBObject[]> {
        return await (await this.collection()).find({
            $and: [
                {userId: {$not: {$eq: userId}}},
                {hidden: false}
            ]

        }).toArray()
    }

    public async create(options: CreateRoomOptions & { userId: string }): Promise<string> {
        const name = options.name || "Anonymous"
        const selectedColor = options.selectedColor || "random"
        const userId = options.userId
        const minPerSide = options.minutesPerSide || Infinity
        const incPerSide = options.incrementPerSide || 0

        return (await (await this.collection()).insertOne({
            name: name,
            userId: userId,
            color: selectedColor,
            timeMinutes: minPerSide,
            incrementSeconds: incPerSide,
            hidden: options.hidden,
        })).insertedId.toString()
    }

    public async delete(roomId: string): Promise<void> {
        const deleteResult = await (await this.collection()).deleteOne({_id: new ObjectId(roomId)});
        console.log("deleted" , deleteResult)
    }

    public async getById(roomId: string): Promise<RoomDBObject | null> {
        return (await this.collection()).findOne({_id: new ObjectId(roomId)})
    }
}