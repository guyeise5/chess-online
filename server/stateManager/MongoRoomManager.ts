import {CreateRoomOptions} from "./IStateManager";
import {Collection, MongoClient, ObjectId, WithId} from "mongodb";
import {mongoClient, mongodbDbName, mongodbPuzzlesCollectionName} from "../config";
import {Color} from "chess.js";

export type RoomDBObject = Readonly<WithId<{
    name: string | null
    userId: string
    color: Color | "random"
    hidden: boolean
    timeMinutes: number | null
    incrementSeconds: number
}>>
export type GetAllOptions = {
    limit?: number
}

export class MongoRoomManager {
    private client: MongoClient
    private dbName: string

    constructor() {
        this.client = mongoClient()
        this.dbName = mongodbDbName
    }

    private collection(): Collection<RoomDBObject> {
        return this.client.db(this.dbName).collection(mongodbPuzzlesCollectionName)
    }

    public async getAll(options?: GetAllOptions): Promise<RoomDBObject[]> {
        let query = this.collection().find();
        if (options?.limit) {
            query = query.limit(options.limit)
        }

        return query.toArray()
    }

    public async create(options: CreateRoomOptions): Promise<void> {
        const name = options.name || null
        const selectedColor = options.selectedColor
        const userId = options.userId
        const minPerSide = options.minutesPerSide
        const incPerSide = options.incrementPerSide
        const doc: RoomDBObject = {
            _id: new ObjectId(),
            name: name,
            userId: userId,
            color: selectedColor,
            timeMinutes: minPerSide,
            incrementSeconds: incPerSide,
            hidden: options.hidden,
        }

        await this.collection().insertOne(doc)
    }

    public async delete(roomId: string): Promise<void> {
        await this.collection().deleteOne({roomId: roomId})
    }

    public async getById(roomId: string): Promise<RoomDBObject | null> {
        return this.collection().findOne({_id: new ObjectId(roomId)})
    }
}