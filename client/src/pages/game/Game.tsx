import {ReactElement, useEffect, useState} from "react";
import {Chessboard} from "react-chessboard";
import './Game.css'
import {BLACK, Chess, Color, Move, Square} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import {heartbeatIntervalMillis} from "../../config";

const chess = new Chess()
const moveSound = new Audio("./mp3/soundMove.mp3")
const checkmateSound = new Audio("./mp3/checkmate.mp3")
const Game = (): ReactElement => {
    const {search} = useLocation()
    const params = new URLSearchParams(search)
    const color = params.get("color") || undefined
    const boardOrientation = color === BLACK ? "black" : "white"
    const roomId = params.get("roomId")
    const [fen, _setFen] = useState<string>(localStorage.getItem(`${roomId}-fen`) || chess.fen())

    const setFen = (newFen: string) => {
        if (newFen != fen) {
            _setFen(newFen)
            moveSound.play().finally()
        }
    }
    console.log("boardOrientation", boardOrientation)

    function isDraggablePiece({sourceSquare}: { sourceSquare: string }): boolean {
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

    socket().on("move", (message: SocketMessage<Move>) => {
        if (message.topic !== topicName) {
            return;
        }

        const move = message.data
        setFen(move.after)
    })

    socket().on("gameDisconnect", (message: SocketMessage<{ color: Color }>) => {
        if (message.topic !== topicName) {
            return
        }

        console.log("game disconnected", message.data.color)

        alert(color === message.data.color ? "you are disconnected" : "opponent disconnected")
    })

    useEffect(() => {
        localStorage.setItem(`${roomId}-fen`, fen)
    }, [fen]);

    useEffect(() => {
        chess.load(fen)

        if (chess.isCheckmate()) {
            checkmateSound.play().finally()
        }
    }, [fen]);

    useEffect(() => {
        if (chess.isCheck() || chess.isCheckmate()) {
            if (chess.turn() == BLACK) {
                document?.querySelectorAll('[data-piece="bK"]')?.item(0)?.classList?.add("checked")
            } else {
                document?.querySelectorAll('[data-piece="wK"]')?.item(0)?.classList?.add("checked")
            }
        } else {
            document?.querySelectorAll('[data-piece="bK"]')?.item(0)?.classList?.remove("checked")
            document?.querySelectorAll('[data-piece="wK"]')?.item(0)?.classList?.remove("checked")

        }
    }, [fen]);

    function periodicHeartbeat() {
        return setInterval(() => axios.post(`/api/v1/room/${roomId}/heartbeat`, {}).finally(), heartbeatIntervalMillis)
    }

    useEffect(() => {
        const task = periodicHeartbeat()
        return () => clearInterval(task)
    }, []);

    return <div id={"mainGameDiv"}>
        <Chessboard boardOrientation={boardOrientation} boardWidth={500}
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    isDraggablePiece={isDraggablePiece}
        />
    </div>
}

export default Game