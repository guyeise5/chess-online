import {ChessRoom, ClientStatus} from "../stateManager/IStateManager";
import {Square, SQUARES} from "chess.js";
import {noHeartbeatMaxTimeMillis} from "../config";
import stateManager from "../stateManager";

export const isGameAvailable = (room: ChessRoom | undefined): boolean => {
    if (!room) {
        return false;
    }

    if (!room.blackPlayerId || !room.whitePlayerId) {
        return false;
    }

    return !room.chess.isGameOver()
}

export const toSquare = (s: string | undefined): Square | undefined => {
    return SQUARES.find(square => square === s)
}

export function isProd(): boolean {
    return process.env.NODE_ENV != 'development'
}

export function isPlayerDisconnected(clientStatus: ClientStatus, now: Date = new Date()): boolean {
    return millisecondsSince(clientStatus.lastHeartbeat, now) > noHeartbeatMaxTimeMillis
}

function millisecondsSince(date?: Date, now: Date = new Date()): number {
    const s = date || new Date(0)
    return now.valueOf() - s.valueOf()
}

export function shutdownGame(roomId: string) {
    stateManager.deleteRoom(roomId)
}