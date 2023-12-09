import {Chessboard} from "react-chessboard";
import {BLACK, Chess, Color, DEFAULT_POSITION} from "chess.js";
import {Arrow, Piece, Square} from "react-chessboard/dist/chessboard/types";
import {useEffect, useMemo, useState} from "react";
import {cleanSquareHighlight, highlightSquares} from "./utils";
import './MyChessBoard.css'

export type Properties = {
    color: Color
    customArrows?: Arrow[];
    id?: string
    width?: number
    fen?: string
    onPieceDragBegin?(piece: Piece, sourceSquare: Square): any
    onPieceDragEnd?(piece: Piece, sourceSquare: Square): any
    onPieceDrop?(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean
    isDraggablePiece?(args: { piece: Piece; sourceSquare: Square; }): boolean
    arePremovesAllowed?: boolean
}
export default function (props: Properties) {
    const chess = useMemo(() => new Chess(props.fen), [props.fen])
    const moveSound = useMemo(() => new Audio("./mp3/soundMove.mp3"), [])
    const checkmateSound = useMemo(() => new Audio("./mp3/checkmate.mp3"), [])
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

    function onPieceDragBegin(piece: Piece, sourceSquare: Square): any {
        setSelectedSquare(sourceSquare)
        return props.onPieceDragBegin && props.onPieceDragBegin(piece, sourceSquare)
    }

    function onPieceDragEnd(piece: Piece, sourceSquare: Square): any {
        setSelectedSquare(null)
        props.onPieceDragEnd && props.onPieceDragEnd(piece, sourceSquare)
    }

    function onPieceDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
        if (!props.onPieceDrop) {
            return true
        }
        return props.onPieceDrop(sourceSquare, targetSquare, piece)
    }

    function isDraggablePiece(args: { piece: Piece; sourceSquare: Square; }): boolean {
        if (props.isDraggablePiece) {
            return props.isDraggablePiece(args)
        }

        return args.piece[0] == props.color
    }

    useEffect(() => {
        if (chess.isCheckmate()) {
            checkmateSound.play().finally()
        }
    }, [props.fen]);

    useEffect(() => {
        cleanSquareHighlight()
        moveSound.play().finally()

        if (chess.isCheck() || chess.isCheckmate()) {
            if (chess.turn() == BLACK) {
                document?.querySelectorAll('[data-piece="bK"]')?.item(0)?.classList?.add("checked")
            } else {
                document?.querySelectorAll('[data-piece="wK"]')?.item(0)?.classList?.add("checked")
            }
        }
    }, [props.fen]);

    useEffect(() => {
        const square = selectedSquare || undefined
        highlightSquares(chess, square)
    }, [selectedSquare]);

    return<div className={"chessBoardContainer"}>
        <div>
            <Chessboard id={props.id || ""}
                        boardWidth={props.width || 500}
                        position={props.fen || DEFAULT_POSITION}
                        onPieceDragBegin={onPieceDragBegin}
                        onPieceDragEnd={onPieceDragEnd}
                        onPieceDrop={onPieceDrop}
                        isDraggablePiece={isDraggablePiece}
                        arePremovesAllowed={props.arePremovesAllowed || false}
                        boardOrientation={props.color == BLACK ? "black" : "white"}
                        promotionDialogVariant={"vertical"}
                        customArrows={props.customArrows || []}
            />
        </div>
    </div>
}