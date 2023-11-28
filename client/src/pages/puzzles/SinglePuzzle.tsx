import {Dispatch, ReactElement, SetStateAction, useEffect, useMemo, useState} from "react";
import {Chess, Color, Square} from "chess.js";
import {Piece} from "react-chessboard/dist/chessboard/types";
import {calculateNewRating} from "./utils";
import MyChessBoard from "../my-chess-board/MyChessBoard";

type PuzzleProps = {
    fen: string
    moves: string[],
    rating: number
    next(newRating: number): void
    color: Color
    setRating: Dispatch<SetStateAction<number>>
    showSolutionEvent(): void
}

export default function (props: PuzzleProps): ReactElement {
    const chess = useMemo(() => new Chess(props.fen), [])
    const [currentFen, setCurrentFen] = useState<string>(props.fen)
    let moves = useMemo(() => [...props.moves].reverse(), [])
    const color = props.color
    const [firstTry, setFirstTry] = useState<boolean>(true)
    // const [showSolution, setShowSolution] = useState<boolean>(true)
    useEffect(() => {
        playComputerMove()
    }, []);

    function makeAMoveImmediately(): boolean {
        const move = moves.pop()
        if (!move) {
            return false
        }

        try {
            chess.move(move)
        } catch (e) {
            return false;
        }

        setCurrentFen(chess.fen())
        if (moves.length === 0) {

            props.next(firstTry ? calculateNewRating(props.rating, true) : props.rating)
        }
        return true
    }

    function playComputerMove() {
        if (!moves.length) {
            return;
        }
        setTimeout(() => {
            makeAMoveImmediately()
            console.log("leftoverMoves", moves)
        }, 500)
    }

    function onPieceDrop(sourceSquare: Square, targetSquare: Square, piece: Piece): boolean {
        if (chess.turn() !== color) {
            return false
        }
        const topMove = moves.at(-1) || ""
        const promotion = piece[1].toLowerCase()
        const playedMoves = [sourceSquare + targetSquare, sourceSquare + targetSquare + promotion]
        if (playedMoves.includes(topMove)) {
            makeAMoveImmediately()
            playComputerMove()
            return true;
        } else if (firstTry) {
            props.setRating(curr => calculateNewRating(curr, false))
            setFirstTry(false)
        }

        return false
    }


    function showSolutionClicked() {
        props.showSolutionEvent()
    }

    return <div>
        {<MyChessBoard
            fen={currentFen}
            color={color}
            onPieceDrop={onPieceDrop}
        />}
        {firstTry || <button onClick={showSolutionClicked}> Show Solution </button>}
    </div>
}