import {Chess, Color, BLACK, WHITE, PieceSymbol, Square, SQUARES} from "chess.js";
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
    if (boardOrientation == 'black') {
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


type Piece = {
    type: PieceSymbol
    color: Color
}

export const getPiecePosition = (chess: Chess, piece: Piece): Square[] => {
    //@ts-ignore
    return [].concat(...chess.board())
        .map((p: Piece | null, index) => {
            if (p !== null && p.type === piece.type && p.color === piece.color) {
                return index
            }
            return undefined
        })
        .flatMap(n => Number.isInteger(n) && n != undefined ? [n] : [])
        .map((piece_index) => {
            const row = 'abcdefgh'[piece_index % 8]
            const column = Math.ceil((64 - piece_index) / 8)
            return row + column
        }).map(s => toSquare(s))
        .flatMap(x => x ? [x] : [])
}

export function toSquare(s: string | undefined | null): Square | undefined {
    return SQUARES.find(x => s == x)
}

export function highlightSquares(chess: Chess, selectedSquare?: Square, preMove?: MinimalMove) {
    cleanSquareHighlight()
    if (preMove) {
        document?.querySelectorAll(`[data-square="${preMove.from}"]`)?.item(0)?.classList?.add("preMoveSource")
        document?.querySelectorAll(`[data-square="${preMove.to}"]`)?.item(0)?.classList?.add("preMoveDest")
    } else if (selectedSquare) {
        const moves = chess.moves({verbose: true, square: selectedSquare});

        document?.querySelectorAll(`[data-square="${selectedSquare}"]`)?.item(0)?.classList?.add("selectedPiece")

        moves.forEach(move => {
            document?.querySelectorAll(`[data-square="${move.to}"]`)?.item(0)?.classList?.add("possibleMove")
        })
    }
}

export function cleanSquareHighlight() {
    SQUARES.forEach(square => {
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("selectedPiece")
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("possibleMove")
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("preMoveSource")
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("preMoveDest")
    })
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