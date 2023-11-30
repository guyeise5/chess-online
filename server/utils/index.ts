import {ChessRoom, ClientStatus} from "../stateManager/IStateManager";
import {BLACK, Color, Square, SQUARES, WHITE} from "chess.js";
import {noHeartbeatMaxTimeMillis} from "../config";
import stateManager from "../stateManager";
import {Puzzle} from "../dal/IPuzzleDAL";
import {Flag, GameOverReason} from "./types/GameOver";
import {deleteTopic, publish} from "../servers/webSocketServer";

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

type CancelFunction = () => void

function clockTick(room: ChessRoom, color: Color): CancelFunction {
    const timeKey: keyof ChessRoom = color === BLACK ? "whitePlayerSeconds" : "blackPlayerSeconds"
    if (room[timeKey]) {
        const interval = setInterval(() => {
                let playerSecondsLeft = room[timeKey];
                if (playerSecondsLeft) {
                    playerSecondsLeft = playerSecondsLeft - 0.1
                    if (playerSecondsLeft <= 0) {
                        handleTimeOver(room, color)
                    }

                    room[timeKey] = playerSecondsLeft
                }
            }, 100
        )
        return () => clearInterval(interval)
    }

    return () => {
    }
}

export function startGame(room: ChessRoom): void {
    room.cancelWhitePlayerInterval = clockTick(room, WHITE)
}

function incrementTime(room: ChessRoom, color: Color) {
    const timeKey: keyof ChessRoom = color === BLACK ? "whitePlayerSeconds" : "blackPlayerSeconds"
    const timeIncKey: keyof ChessRoom = color === BLACK ? "whitePlayerIncSeconds" : "blackPlayerIncSeconds"
    const curTime = room[timeKey]
    if(curTime) {
        room[timeKey] = curTime + room[timeIncKey]
    }
}

export function handleTimersOnTurnSwitch(room: ChessRoom) {
    const color = room.chess.turn()
    incrementTime(room, color)
    stopBothTimers(room)
    clockTick(room, color)
}

function stopBothTimers(room: ChessRoom) {
    room.cancelWhitePlayerInterval && room.cancelWhitePlayerInterval();
    room.cancelBlackPlayerInterval && room.cancelBlackPlayerInterval();
}

function clearGame(roomId: string) {
    deleteTopic(`room-${roomId}`)
    stateManager.deleteRoom(roomId)
}

function triggerGameOver(roomId: string, reason: GameOverReason) {
    publish("gameOver", `room-${roomId}`, reason)
    clearGame(roomId)
}
function handleTimeOver(room: ChessRoom, color: Color) {
    const reason: Flag = {
        type: "FLAG",
        winner: color == WHITE ? BLACK : WHITE
    }
    triggerGameOver(room.id, reason)
}

export function handleGameOver(room: ChessRoom) {
    const chess = room.chess
    let reason: GameOverReason | undefined = undefined
    if(chess.isCheckmate()) {
        reason = {
            type: "CHECKMATE",
            winner: chess.turn() == WHITE ? BLACK : WHITE
        }
    } else if(chess.isDraw()) {
        reason = {
            type: "DRAW"
        }

        if(chess.isStalemate()) {
            reason.details = "stalemate"
        } else if(chess.isThreefoldRepetition()) {
            reason.details = "three fold repetition"
        } else if(chess.isInsufficientMaterial()) {
            reason.details = "insufficient material"
        }
    }

    reason && triggerGameOver(room.id, reason)
}