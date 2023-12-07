import {mongoClient, mongodbDbName, mongodbGamesCollectionName, mongodbRoomsCollectionName} from "../config";
import {GameDBObject} from "./MongoGameManager";
import {
    ChangeStream,
    ChangeStreamDeleteDocument, ChangeStreamDocument,
    ChangeStreamInsertDocument,
    ChangeStreamUpdateDocument
} from "mongodb";
import {publish} from "../servers/webSocketServer";
import {handleGameOverIfNeeded, triggerGameOver} from "../utils";
import {BLACK, Chess, WHITE} from "chess.js";
import {RoomDBObject} from "./MongoRoomManager";

async function handleGameStream(gamesStream: ChangeStream<GameDBObject, ChangeStreamDocument<GameDBObject>>) {
    for await (const change of gamesStream) {
        if (change.operationType == 'update') {
            onUpdateGame(change).finally()
        }
        if (change.operationType == 'insert') {
            onInsertGame(change).finally()
        }
    }
}

async function handleRoomStream(roomStream: ChangeStream<RoomDBObject, ChangeStreamDocument<RoomDBObject>>) {
    for await (const change of roomStream) {
        if (change.operationType == 'insert') {
            onInsertRoom(change).finally()
        } else if (change.operationType == 'delete') {
            onDeleteRoom(change).finally()
        }
    }
}

export default async function initSubscribers() {
    const client = await mongoClient()
    const gamesStream = client.db(mongodbDbName)
        .collection<GameDBObject>(mongodbGamesCollectionName).watch([], {fullDocument: "updateLookup"});

    const roomStream = client
        .db(mongodbDbName)
        .collection<RoomDBObject>(mongodbRoomsCollectionName)
        .watch([], {fullDocument: "updateLookup"})

    handleGameStream(gamesStream);
    handleRoomStream(roomStream);
}

async function onDeleteRoom(_change: ChangeStreamDeleteDocument<RoomDBObject>) {
    publish("roomListUpdate", "roomList", "1")
}

async function onInsertRoom(change: ChangeStreamInsertDocument<RoomDBObject>) {
    const room = change.fullDocument
    if (room.hidden) {
        return
    }

    publish("roomListUpdate", "roomList", "1")
}

async function onInsertGame(change: ChangeStreamInsertDocument<GameDBObject>) {
    const game: GameDBObject | undefined = change.fullDocument
    if (!game) {
        return
    }

    publish("gameStarted", `game-${game._id.toString()}`, "1")
    publish("player-joined", `room-${game.sourceRoomId}`, {gameId: game._id.toString()})
}

async function onUpdateGame(change: ChangeStreamUpdateDocument<GameDBObject>) {
    const game: GameDBObject | undefined = change.fullDocument
    if (!game) {
        return
    }
    if (change.updateDescription.updatedFields?.pgn) {
        publish("pgn_update", `game-${game._id.toString()}`, game)
        const chess = new Chess()
        chess.loadPgn(game.pgn)
        handleGameOverIfNeeded(game._id.toString(), chess)
    }

    if (change.updateDescription.updatedFields?.whitePlayerTimeSeconds ||
        change.updateDescription.updatedFields?.blackPlayerTimeSeconds) {
        if (game.blackPlayerTimeSeconds <= 0) {
            triggerGameOver(game._id.toString(), {
                type: "FLAG",
                winner: WHITE
            }).finally()
        } else if (game.whitePlayerTimeSeconds <= 0) {
            triggerGameOver(game._id.toString(), {
                type: "FLAG",
                winner: BLACK
            }).finally()
        }
    }
}