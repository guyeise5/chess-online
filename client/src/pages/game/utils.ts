import {BLACK, WHITE, Square, SQUARES, Chess} from "chess.js";

export function toSquare(s: string | undefined | null): Square | undefined {
    return SQUARES.find(x => s == x)
}

export type Promotion = 'n' | 'b' | 'r' | 'q'
export type MinimalMove = {
    from: Square
    to: Square
    promotion: Promotion
}

export function toPromotion(s: string): Promotion {
    switch (s) {
        case 'n':
        case 'b':
        case 'r':
        case 'q':
            return s
        default:
            return 'q'
    }
}

export function toColorFromString(s?: string | null) {
    switch (s) {
        case WHITE:
            return WHITE
        case BLACK:
            return BLACK
        default:
            return undefined
    }
}

export function getRoomTopicName(roomId?: string): string | undefined {
    if (!roomId) {
        return undefined
    }
    return `room-${roomId}`;
}

export function getGameTopicName(gameId: string): string {
    return `game-${gameId}`;
}

export function chessFromPgn(pgn: string): Chess  {
    const chess = new Chess()
    chess.loadPgn(pgn)
    return chess
}
