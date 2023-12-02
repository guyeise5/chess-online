import {BLACK, WHITE, Square, SQUARES} from "chess.js";


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

export function getTopicName(roomId?: string): string | undefined {
    if (!roomId) {
        return undefined
    }
    return `room-${roomId}`;
}
