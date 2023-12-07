import {Color} from "chess.js";
import {dalRoomManager} from "../../stateManager";
import {RoomDBObject} from "../../stateManager/MongoRoomManager";
import {GameDBObject} from "../../stateManager/MongoGameManager";

type RoomInstanceWebSocketMessage = {
    name: string,
    roomId: string,
    timeSeconds: number | null,
    incSeconds: number,
    color: Color | "random",
}

export function roomToWebSocketMessage(room: RoomDBObject): RoomInstanceWebSocketMessage {
    return {
        name: room.name || "",
        timeSeconds: room.timeMinutes,
        roomId: room._id.toString(),
        incSeconds: room.incrementSeconds,
        color: room.color
    }
}

export async function getPublicAvailableRoomList(userId: string) {
    return (await dalRoomManager.getAvailable(userId))
}

export type MinimalGame = Omit<GameDBObject, "whitePlayerId" | "blackPlayerId">

export function toMinimalGame(game: GameDBObject): MinimalGame {
    const cleanGame = {...game, whitePlayerId: undefined, blackPlayerId: undefined}
    return cleanGame
}