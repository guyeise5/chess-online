import {ReactElement, useEffect, useMemo, useState} from "react";
import './Game.css'
import { Chess, Color, Move, Square, WHITE} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import {heartbeatIntervalMillis} from "../../config";
import { getTopicName, MinimalMove, toColorFromString, toSquare} from "./utils";
import {Piece} from "react-chessboard/dist/chessboard/types";
import MyChessBoard from "../my-chess-board/MyChessBoard";

const Game = (): ReactElement => {
    const chess = useMemo(() => new Chess(), [])
    const checkmateSound = useMemo(() => new Audio("./mp3/checkmate.mp3"), [])
    const {search} = useLocation()
    const params = useMemo(() => new URLSearchParams(search), [search])
    const myColor: Color = useMemo(() => toColorFromString(params.get("color")) || WHITE, [params])
    const roomId = useMemo(() => params.get("roomId"), [params])
    const [fen, _setFen] = useState<string>(localStorage.getItem(`${roomId}-fen`) || chess.fen())
    const topicName = useMemo(() => getTopicName(roomId || ""), [roomId])

    const setFen = (newFen: string) => {
        if (newFen != fen) {
            _setFen(newFen)
        }
    }

    function isDraggablePiece({piece}: { piece: Piece; sourceSquare: Square; }): boolean {
        return piece[0] == myColor
    }

    function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
        const from = toSquare(sourceSquare)
        const to = toSquare(targetSquare)
        if (!from || !to) {
            return false
        }

        const mv: MinimalMove = {
            from: from,
            to: to,
            promotion: piece[1].toLowerCase() as any ?? "q"
        };

        if (chess.turn() !== myColor) {
            console.log("setting premove", mv)
            return true
        } else {
            return doMove(mv)
        }
    }

    function doMove(move: MinimalMove): boolean {
        try {
            chess.move(move)
            setFen(chess.fen())
            axios.post(`/api/v1/room/${roomId}/move`, move).catch(e => {
                console.error(e)
                axios.get(`/api/v1/room/${roomId}/fen`)
                    .then(resp => setFen(resp.data.toString()))
                    .catch(e => console.log(e))
            })
            return true
        } catch (e) {
            console.log("failed to move", e)
            return false
        }
    }

    function gameDisconnectListener(message: SocketMessage<{ color: Color }>) {
        if (message.topic !== topicName) {
            return
        }

        console.log("game disconnected", message.data.color)

        alert(myColor === message.data.color ? "you are disconnected" : "opponent disconnected")
    }

    function onMoveListener(message: SocketMessage<Move>) {
        if (message.topic !== topicName) {
            return;
        }

        const move = message.data
        setFen(move.after)
    }

    useEffect(() => {
        topicName && socket().emit("subscribe", topicName)
        socket().on("move", onMoveListener)
        socket().on("gameDisconnect", gameDisconnectListener)

        return () => {
            topicName && socket().emit("unsubscribe", topicName)
            socket().off("move", onMoveListener)
            socket().off("gameDisconnect", gameDisconnectListener)
        }
    }, []);

    useEffect(() => {
        axios.get(`/api/v1/room/${roomId}/fen`).then(resp => setFen(resp.data))
    }, []);

    useEffect(() => {
        localStorage.setItem(`${roomId}-fen`, fen)
    }, [fen]);

    useEffect(() => {
        chess.load(fen)

        if (chess.isCheckmate()) {
            checkmateSound.play().finally()
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
        <MyChessBoard color={myColor}
                      fen={fen}
                      onPieceDrop={onPieceDrop}
                      isDraggablePiece={isDraggablePiece}
                      arePremovesAllowed={true}
        />
    </div>
}

export default Game