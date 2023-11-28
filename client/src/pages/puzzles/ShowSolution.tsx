import React, {ReactElement, useMemo, useState} from "react";
import {BLACK, Chess, WHITE} from "chess.js";
import {Arrow, BoardOrientation} from "react-chessboard/dist/chessboard/types";
import {toSquare} from "../game/utils";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa6";
import MyChessBoard from "../my-chess-board/MyChessBoard";

type ShowSolutionProps = {
    fen: string
    moves: string[]
    boardOrientation: BoardOrientation
    nextPuzzleClick(): void
}
export default function (props: ShowSolutionProps): ReactElement {
    const [currentFen, setCurrentFen] = useState<string>(props.fen)
    const chess = useMemo(() => new Chess(props.fen), [props.fen])
    const moves = props.moves
    const [moveIndex, setMoveIndex] = useState<number>(0)
    const myColor = props.boardOrientation == 'black' ? BLACK : WHITE

    function handleLeftArrowPressed() {
        try {
            chess.undo()
            setCurrentFen(chess.fen())
            setMoveIndex(curr => curr - 1)
        } catch (e) {

        }
    }

    function handleRightArrowPressed() {
        const move = moves[moveIndex]
        if (!move) {
            return;
        }

        try {
            chess.move(move)
        } catch (e) {
            return
        }
        setCurrentFen(chess.fen())
        setMoveIndex(curr => curr + 1)
    }

    function arrows(): Arrow[] {
        const move = moves[moveIndex]
        if (!move) {
            return []
        }

        const from = toSquare(move.substring(0, 2))
        const to = toSquare(move.substring(2, 4))

        if (!from || !to) {
            return []
        }
        const color = chess.get(from).color

        return [
            [from, to, color == myColor ? 'green' : 'gray']
        ]

    }

    function onKeyDown(event: React.KeyboardEvent): void {
        console.log("key down")
        const left = "37"
        const right = "39"

        switch (event.code) {
            case left:
                handleLeftArrowPressed()
                break
            case right:
                handleRightArrowPressed()
                break
        }
    }

    return <div onKeyDown={onKeyDown}>
        <MyChessBoard
            fen={currentFen}
            isDraggablePiece={() => false}
            color={myColor}
            customArrows={arrows()}/>
        <button onClick={handleLeftArrowPressed} disabled={moveIndex <= 0}><FaArrowLeft/></button>
        <button onClick={handleRightArrowPressed} disabled={moveIndex >= moves.length}><FaArrowRight/></button>
        <button onClick={props.nextPuzzleClick}>Next puzzle</button>
    </div>
}