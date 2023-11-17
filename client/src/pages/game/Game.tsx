import {ReactElement, useEffect, useState} from "react";
import {Chessboard} from "react-chessboard";
import './Game.css'
import {BLACK, Chess, Square} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket} from "../../webSocket/webSocketManager";

const chess = new Chess()

const Game = (): ReactElement => {
    //@ts-ignore
    const { _pathname, search } = useLocation()
    const params = new URLSearchParams(search)
    const color = params.get("color") || undefined
    const boardOrientation = color === BLACK ? "black" : "white"
    const roomId = params.get("roomId")
    const [fen, setFen] = useState<string>(localStorage.getItem(`${roomId}-fen`) || chess.fen())

    console.log("boardOrientation", boardOrientation)
    function isDraggablePiece({ sourceSquare}: { sourceSquare: string }): boolean {
        const square = sourceSquare as Square
        return chess.get(square).color === color
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

            return true;
        } catch (e) {
            console.log("failed to move", e)
            return false
        }
    }

    const topicName = `room-${roomId}`;
    socket().emit("subscribe", topicName)


    useEffect(() => {
        axios.get(`/api/v1/room/${roomId}/fen`).then(resp => setFen(resp.data))
    }, []);
    socket().on("message", (message: {topic: string, message: string}) => {
        if(message.topic !== topicName) {
            return;
        }
        const fen = message.message
        setFen(fen)
    })

    useEffect(() => {
        localStorage.setItem(`${roomId}-fen`, fen)
    }, [fen]);

    useEffect(() => {
        chess.load(fen)
    }, [fen]);

    useEffect(() => {
        if(chess.isCheck() || chess.isCheckmate()) {
            if(chess.turn() == BLACK) {
                document?.querySelectorAll('[data-piece="bK"]')?.item(0)?.classList?.add("checked")
            } else {
                document?.querySelectorAll('[data-piece="wK"]')?.item(0)?.classList?.add("checked")
            }
        } else {
            document?.querySelectorAll('[data-piece="bK"]')?.item(0)?.classList?.remove("checked")
            document?.querySelectorAll('[data-piece="wK"]')?.item(0)?.classList?.remove("checked")

        }
    }, [fen]);
    return <div id={"mainGameDiv"}>
        <Chessboard boardOrientation={boardOrientation} boardWidth={500}
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    isDraggablePiece={isDraggablePiece}
        />
    </div>
}

export default Game