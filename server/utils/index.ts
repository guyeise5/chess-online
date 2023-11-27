import {ChessRoom, ClientStatus} from "../stateManager/IStateManager";
import {Square, SQUARES} from "chess.js";
import {noHeartbeatMaxTimeMillis} from "../config";
import stateManager from "../stateManager";
import {Puzzle} from "../dal/IPuzzleDAL";

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

export function toPuzzle(obj: unknown): Puzzle | undefined {
    const p: Puzzle = obj as Puzzle
    if (p?.puzzleId &&
        p.fen &&
        p.moves?.length &&
        p.rating &&
        p.ratingDeviation >= 0) {
        return p
    }

    return undefined
}