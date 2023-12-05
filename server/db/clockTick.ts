import {MongoClient} from "mongodb";
import {
    mongodbConnectionString,
    mongodbDbName,
    mongodbGamesCollectionName,
    mongodbUpdateTimesIntervalMillis
} from "../config";
import {GameDBObject} from "../stateManager/MongoGameManager";
import {BLACK, WHITE} from "chess.js";

async function main() {
    const client = new MongoClient(mongodbConnectionString)
    await client.connect()

    console.log("Connected to Mongo")
    console.log("Starting clock ticking")

    setInterval(() => {
        const collection = client.db(mongodbDbName).collection<GameDBObject>(mongodbGamesCollectionName)
        collection.updateMany({
                $and: [
                    {currentPlayerToPlay: WHITE},
                    {over: false}
                ]
            },
            {$inc: {whitePlayerTimeSeconds: -(mongodbUpdateTimesIntervalMillis / 1000)}}
        )

        collection.updateMany({
                $and: [
                    {currentPlayerToPlay: BLACK},
                    {over: false}
                ]
            },
            {$inc: {blackPlayerTimeSeconds: -(mongodbUpdateTimesIntervalMillis / 1000)}}
        )

    }, mongodbUpdateTimesIntervalMillis)

}

main()