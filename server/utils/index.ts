import {BLACK, Chess, Color, WHITE} from "chess.js";
import {Puzzle} from "../dal/IPuzzleDAL";
import {Flag, GameOverReason} from "./types/GameOver";
import {deleteTopic, publish} from "../servers/webSocketServer";
import {dalGameManager} from "../stateManager";

export function isProd(): boolean {
    return process.env.NODE_ENV != 'development'
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



async function clearGame(gameId: string) {
    deleteTopic(`game-${gameId}`)
    await dalGameManager.delete(gameId)
}

export async function triggerGameOver(gameId: string, reason: GameOverReason) {
    publish("gameOver", `game-${gameId}`, reason)
    await clearGame(gameId)
}

export async function handleTimeOver(gameId: string, color: Color) {
    const reason: Flag = {
        type: "FLAG",
        winner: color == WHITE ? BLACK : WHITE
    }
    await triggerGameOver(gameId, reason)
}

export function handleGameOverIfNeeded(gameId: string, chess: Chess) {
    let reason: GameOverReason | undefined = undefined
    if (chess.isCheckmate()) {
        reason = {
            type: "CHECKMATE",
            winner: chess.turn() == WHITE ? BLACK : WHITE,
            pgn: chess.pgn()
        }
    } else if (chess.isDraw()) {
        reason = {
            type: "DRAW",
            pgn: chess.pgn()
        }

        if (chess.isStalemate()) {
            reason.details = "stalemate"
        } else if (chess.isThreefoldRepetition()) {
            reason.details = "three fold repetition"
        } else if (chess.isInsufficientMaterial()) {
            reason.details = "insufficient material"
        }
    }

    reason && triggerGameOver(gameId, reason)
}