import {MongoClient} from "mongodb";

export const noHeartbeatMaxTimeMillis: number = Number(process.env.NO_HEARTBEAT_MAX_TIME_MILLIS) || 5_000
export const mongodbConnectionString = process.env.MONGODB_CONNECTION_STRING || "mongodb://localhost:27017"
export const mongodbDbName = "chess"
export const mongodbPuzzlesCollectionName = "puzzles"
export const mongodbRoomsCollectionName = 'rooms'
export const mongodbGamesCollectionName = 'games'
export const mongodbUpdateTimesIntervalMillis =  Number(process.env.MONGODB_UPDATE_TIME_ITERVAL_MILLIS) || 200

let mongodbClient: MongoClient | undefined = undefined

export async function mongoClient(): Promise<MongoClient> {
    if (!mongodbClient) {
        mongodbClient = new MongoClient(mongodbConnectionString, {
            readPreference: "secondaryPreferred"
        });
        console.log("connection string", mongodbConnectionString)
        await mongodbClient.connect()
        console.log("connected to mongodb")
    }
    return mongodbClient
}