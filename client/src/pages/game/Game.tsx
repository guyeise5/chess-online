import {ReactElement, useState, useEffect} from "react";
import {Chessboard} from "react-chessboard";
import './Game.css'
import {Chess, Square} from "chess.js";
import {generateRandomMove, toBoardOrientation, toColor} from "./utils";
import axios from 'axios'
import {BoardOrientation} from "react-chessboard/dist/chessboard/types";
const chess = new Chess()

const Game = ({ roomId}: { roomId: string }): ReactElement => {
    const [fen, setFen] = useState<string>(chess.fen())
    const [boardOrientation, setBoardOrientation] = useState<BoardOrientation | undefined>(undefined)
    const color = toColor(boardOrientation)
    function isDraggablePiece({ sourceSquare}: { sourceSquare: string }): boolean {
        const square = sourceSquare as Square
        return chess.turn() === color && chess.get(square).color === color
    }

    function onPieceDrop(sourceSquare: string, targetSquare: string): boolean {
        try {
            const mv = {
                from: sourceSquare,
                to: targetSquare,
                promotion: "q"
            };
            chess.move(mv)
            setFen(chess.fen())
            axios.post(`/api/v1/room/${roomId}/move`, mv).catch(e => {
                console.error(e)
                axios.get(`/api/v1/room/${roomId}/fen`)
                    .then(resp => setFen(resp.data.toString()))
                    .catch(e => console.log(e))
            })
            setTimeout(() => {
                const move = generateRandomMove(chess)
                if (move) {
                    chess.move(move)
                    setFen(chess.fen())
                }

            }, 500)
            return true;
        } catch (e) {
            return false
        }
    }


    useEffect(() => {
        axios.get(`/api/v1/${roomId}/myColor`)
            .catch(e => {
                console.log(e)
                return {data: 'w'}
            })
            .then(resp => {
                setBoardOrientation(toBoardOrientation(resp.data))
            })
    }, []);

    return <div id={"mainGameDiv"}>
        <Chessboard boardOrientation={boardOrientation || 'white'} boardWidth={500}
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    isDraggablePiece={isDraggablePiece}

        />
    </div>
}

export default Game