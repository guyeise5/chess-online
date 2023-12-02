import {MongoClient} from "mongodb";

export const noHeartbeatMaxTimeMillis: number = Number(process.env.NO_HEARTBEAT_MAX_TIME_MILLIS) || 5_000

export const mongodbEnabled = process.env.MONGODB_ENABLED === "true"
export const mongodbConnectionString = process.env.MONGODB_CONNECTION_STRING || "mongodb://localhost:27017"
export const mongodbDbName = "chess"
export const mongodbPuzzlesCollectionName = "puzzles"
export const mongodbRoomsCollectionName = 'rooms'
export const mongodbGamesCollectionName = 'games'

let mongodbClient: MongoClient | undefined = undefined

export function mongoClient(): MongoClient {
    if (!mongodbClient) {
        mongodbClient = new MongoClient(mongodbConnectionString, {
            readPreference: "secondaryPreferred"
        });
    }

    return mongodbClient
}