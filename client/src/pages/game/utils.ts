import {Chess, Color, BLACK, WHITE} from "chess.js";
import {BoardOrientation} from "react-chessboard/dist/chessboard/types";

export const toBoardOrientation = (color: string): BoardOrientation => {
    switch (color) {
        case "w":
            return "white"
        case "b":
            return "black"
        default:
            throw new Error(`unknown color ${color}`)
    }
}

export function toColor(boardOrientation: BoardOrientation | undefined): Color {
    if(boardOrientation == 'black') {
        return BLACK
    }

    return WHITE
}

export function generateRandomMove(chess: Chess): string | undefined {
    const possibleMoves = chess.moves();
    if (chess.isGameOver() || chess.isDraw() || possibleMoves.length === 0)
        return undefined
    const randomIndex = Math.floor(Math.random() * possibleMoves.length);
    return possibleMoves[randomIndex]
}
