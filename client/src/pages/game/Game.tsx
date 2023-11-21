import {ReactElement, useEffect, useMemo, useState} from "react";
import {Chessboard} from "react-chessboard";
import './Game.css'
import {BLACK, Chess, Color, Move, Square} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import {heartbeatIntervalMillis} from "../../config";
import {cleanSquareHighlight, getTopicName, highlightSquares, MinimalMove, toColorFromString, toSquare} from "./utils";
import {Piece} from "react-chessboard/dist/chessboard/types";

const Game = (): ReactElement => {
    const chess = useMemo(() => new Chess(), [])
    const moveSound = useMemo(() => new Audio("./mp3/soundMove.mp3"), [])
    const captureSound = useMemo(() => new Audio("./mp3/capture.mp3"), [])
    const checkmateSound = useMemo(() => new Audio("./mp3/checkmate.mp3"), [])
    const {search} = useLocation()
    const params = useMemo(() => new URLSearchParams(search), [search])
    const myColor: Color | undefined = useMemo(() => toColorFromString(params.get("color")), [params])
    const roomId = useMemo(() => params.get("roomId"), [params])
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
    const boardOrientation = useMemo(() => myColor === BLACK ? "black" : "white", [myColor])
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

    function onPieceDragBegin(_piece: string, sourceSquare: string): void {
        const square = toSquare(sourceSquare)
        if (!square) {
            return;
        }

        setSelectedSquare(square)
    }

    function onPieceDragEnd(_piece: string, sourceSquare: string): void {
        setSelectedSquare(null)
        const square = toSquare(sourceSquare)
        if (!square) {
            return;
        }
    }

    function onSquareClick() {
        setSelectedSquare(null)
    }

    function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string): boolean {
        setSelectedSquare(null)
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
            setSelectedSquare(null)
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

        const sound = move.captured ? captureSound : moveSound
        sound.play().finally()
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

    useEffect(() => {
        cleanSquareHighlight()
    }, [fen]);

    function periodicHeartbeat() {
        return setInterval(() => axios.post(`/api/v1/room/${roomId}/heartbeat`, {}).finally(), heartbeatIntervalMillis)
    }

    useEffect(() => {
        const task = periodicHeartbeat()
        return () => clearInterval(task)
    }, []);

    useEffect(() => {
        const square = toSquare(selectedSquare)
        highlightSquares(chess, square)
    }, [selectedSquare]);

    return <div id={"mainGameDiv"}>
        <Chessboard boardOrientation={boardOrientation} boardWidth={500}
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    onPieceDragBegin={onPieceDragBegin}
                    onPieceDragEnd={onPieceDragEnd}
                    isDraggablePiece={isDraggablePiece}
                    onSquareClick={onSquareClick}
                    arePremovesAllowed={true}
        />
    </div>
}

export default Game