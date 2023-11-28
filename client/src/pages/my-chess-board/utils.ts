import {Chess, Square, SQUARES} from "chess.js";

export function cleanSquareHighlight() {
    SQUARES.forEach(square => {
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("selectedPiece")
        document?.querySelectorAll(`[data-square="${square}"]`)?.item(0)?.classList?.remove("possibleMove")
    })
}

export function highlightSquares(chess: Chess, selectedSquare?: Square) {
    cleanSquareHighlight()
    if (selectedSquare) {
        const moves = chess.moves({verbose: true, square: selectedSquare});

        document?.querySelectorAll(`[data-square="${selectedSquare}"]`)?.item(0)?.classList?.add("selectedPiece")

        moves.forEach(move => {
            document?.querySelectorAll(`[data-square="${move.to}"]`)?.item(0)?.classList?.add("possibleMove")
        })
    }
}