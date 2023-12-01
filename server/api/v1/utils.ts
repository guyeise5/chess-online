import {ChessRoom} from "../../stateManager/IStateManager";
import {BLACK, Color, WHITE} from "chess.js";
import stateManager from "../../stateManager";

type RoomInstanceWebSocketMessage = {
    name: string,
    roomId: string,
    timeSeconds: number | null,
    incSeconds: number,
    color: Color,
    randomChoice: boolean
}

export function roomToWebSocketMessage(room: ChessRoom): RoomInstanceWebSocketMessage {
    return {
        name: room.name,
        timeSeconds: room.whitePlayerSeconds,
        roomId: room.id,
        incSeconds: room.incSeconds,
        color: room.whitePlayerId ? BLACK : WHITE,
        randomChoice: !!room.randomChoice
    }
}

export function getPublicAvailableRoomList(): ChessRoom[] {
    return stateManager
        .getRooms()
        .filter(r => !r.hidden)
        .filter(r => !r.whitePlayerId || !r.blackPlayerId)
}