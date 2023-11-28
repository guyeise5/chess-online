import {  BLACK, WHITE,  Square, SQUARES} from "chess.js";



export function toSquare(s: string | undefined | null): Square | undefined {
    return SQUARES.find(x => s == x)
}

export type MinimalMove = {
    from: Square
    to: Square
    promotion: 'n' | 'b' | 'r' | 'q'
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
