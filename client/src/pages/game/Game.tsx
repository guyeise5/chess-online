import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import './Game.css'
import {BLACK, Chess, Color, Move, Square, WHITE} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import {heartbeatIntervalMillis} from "../../config";
import {getTopicName, MinimalMove, toColorFromString, toSquare} from "./utils";
import {Piece} from "react-chessboard/dist/chessboard/types";
import MyChessBoard from "../my-chess-board/MyChessBoard";
import Clock from "../clock/Clock";

type RoomTimesResponse = {
    whitePlayerSeconds: number | null
    blackPlayerSeconds: number | null
    incrementSeconds: number
}
const Game = (): ReactElement => {
    const chess = useMemo(() => new Chess(), [])
    const checkmateSound = useMemo(() => new Audio("./mp3/checkmate.mp3"), [])
    const {search} = useLocation()
    const params = useMemo(() => new URLSearchParams(search), [search])
    const myColor: Color = useMemo(() => toColorFromString(params.get("color")) || WHITE, [params])
    const roomId = useMemo(() => params.get("roomId"), [params])
    const [fen, _setFen] = useState<string>(localStorage.getItem(`${roomId}-fen`) || chess.fen())
    const topicName = useMemo(() => getTopicName(roomId || ""), [roomId])
    const [myTime, setMyTime] = useState<number | null>(null)
    const [opponentTime, setOpponentTime] = useState<number | null>(null)
    const timeIncrementSeconds = useRef<number>(0)
    function fetchTimesFromServer() {
        axios.get<RoomTimesResponse>(`/api/v1/room/${roomId}/times`).then(resp => {
            const data = resp.data
            setMyTime(myColor == BLACK ? data.blackPlayerSeconds : data.whitePlayerSeconds)
            setOpponentTime(myColor == BLACK ? data.whitePlayerSeconds : data.blackPlayerSeconds)
            timeIncrementSeconds.current= data.incrementSeconds
        })
    }

    function clockTick(deltaSeconds: number) {
        if (chess.turn() == myColor) {
            setMyTime(v => v && Math.max(0, v - deltaSeconds))
        } else {
            setOpponentTime(v => v && Math.max(0, v - deltaSeconds))
        }
    }

    useEffect(() => {
        const ms = 100
        const interval = setInterval(() => clockTick(ms / 1000), ms)
        return () => clearInterval(interval)
    }, []);

    useEffect(() => {
        fetchTimesFromServer()
        const interval = setInterval(fetchTimesFromServer, 5000)
        return () => clearInterval(interval)
    }, []);
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

    // TODO: make the SocketMessage type compatible with the server AKA GameOverReason
    function gameOverListener(message: SocketMessage<{ type: string, winner?: Color }>) {
        if (message.topic !== topicName) {
            return
        }

        const data = message.data
        if (data.winner) {
            if(data.winner == myColor) {
                alert(`You win !`)
            } else {
                alert(`You lose !`)
            }
        } else {
            alert(data.type)
        }

        // navigate("/")
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
        console.log("move", move)
        if(move.color === myColor) {
            setMyTime(v => v && (v + timeIncrementSeconds.current))
        } else {
            setOpponentTime(v => v && (v + timeIncrementSeconds.current))
        }
        setFen(move.after)
    }

    useEffect(() => {
        topicName && socket().emit("subscribe", topicName)
        socket().on("move", onMoveListener)
        socket().on("gameDisconnect", gameDisconnectListener)
        socket().on("gameOver", gameOverListener)

        return () => {
            topicName && socket().emit("unsubscribe", topicName)
            socket().off("move", onMoveListener)
            socket().off("gameDisconnect", gameDisconnectListener)
            socket().off("gameOver", gameOverListener)
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
        {opponentTime && <Clock seconds={opponentTime}/> }
        <MyChessBoard color={myColor}
                      fen={fen}
                      onPieceDrop={onPieceDrop}
                      isDraggablePiece={isDraggablePiece}
                      arePremovesAllowed={true}
        />
        {myTime && <Clock seconds={myTime}/> }
    </div>
}

export default Game