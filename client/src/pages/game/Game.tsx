import {ReactElement, useEffect, useState} from "react";
import {Chessboard} from "react-chessboard";
import './Game.css'
import {BLACK, Chess, Color, Move, Square} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import {heartbeatIntervalMillis} from "../../config";
import {cleanSquareHighlight, highlightSquares, MinimalMove, toColorFromString, toSquare} from "./utils";

const chess = new Chess()
const moveSound = new Audio("./mp3/soundMove.mp3")
const captureSound = new Audio("./mp3/capture.mp3")
const checkmateSound = new Audio("./mp3/checkmate.mp3")
const Game = (): ReactElement => {
    const {search} = useLocation()
    const params = new URLSearchParams(search)
    const myColor: Color | undefined = toColorFromString(params.get("color"))
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
    const boardOrientation = myColor === BLACK ? "black" : "white"
    const roomId = params.get("roomId")
    const [fen, _setFen] = useState<string>(localStorage.getItem(`${roomId}-fen`) || chess.fen())
    const [preMove, setPreMove] = useState<MinimalMove | undefined>(undefined)

    const setFen = (newFen: string) => {
        if (newFen != fen) {
            _setFen(newFen)
        }
    }

    function isDraggablePiece({sourceSquare}: { sourceSquare: string }): boolean {
        const square = sourceSquare as Square
        return chess.get(square).color === myColor
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

    function onSquareClick(sqr: string) {
        const clickedSquare = toSquare(sqr)
        if (!clickedSquare) {
            return;
        }

        if(preMove) {
            if(chess.get(clickedSquare).color === myColor) {
                setSelectedSquare(clickedSquare)
            }

            setPreMove(undefined)
            return;
        }

        if (selectedSquare && clickedSquare !== selectedSquare) {
            if (chess.turn() === myColor) {
                const moves = chess.moves({verbose: true, square: selectedSquare})
                if (moves.find(move => move.to === clickedSquare)) {
                    doMove({
                        from: selectedSquare,
                        to: clickedSquare,
                        promotion: "q"
                    })
                } else {
                    if(chess.get(clickedSquare).color === myColor) {
                        setSelectedSquare(clickedSquare)
                    }
                }
            } else {
                setPreMove({
                    from: selectedSquare,
                    to: clickedSquare,
                    promotion: "q"
                })
            }

            return;
        }

        if (isDraggablePiece({sourceSquare: clickedSquare})) {
            setSelectedSquare(clickedSquare)
            return;
        }
    }

    function onPieceDrop(sourceSquare: string, targetSquare: string): boolean {
        setSelectedSquare(null)
        const from = toSquare(sourceSquare)
        const to = toSquare(targetSquare)
        if (!from || !to) {
            return false
        }

        const mv: MinimalMove = {
            from: from,
            to: to,
            promotion: "q"
        };

        if (chess.turn() !== myColor) {
            console.log("setting premove", mv)
            setPreMove(mv)
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

        const sound = move.captured ? captureSound : moveSound
        sound.play().finally()
    })

    socket().on("gameDisconnect", (message: SocketMessage<{ color: Color }>) => {
        if (message.topic !== topicName) {
            return
        }

        console.log("game disconnected", message.data.color)

        alert(myColor === message.data.color ? "you are disconnected" : "opponent disconnected")
    })

    useEffect(() => {
        localStorage.setItem(`${roomId}-fen`, fen)
    }, [fen]);

    useEffect(() => {
        chess.load(fen)

        if (chess.isCheckmate()) {
            checkmateSound.play().finally()
        }

        if (chess.turn() === myColor && preMove) {
            console.log("doing premove")
            doMove(preMove)
            setPreMove(undefined)
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
        highlightSquares(chess, square, preMove)
    }, [preMove, selectedSquare]);

    return <div id={"mainGameDiv"}>
        <Chessboard boardOrientation={boardOrientation} boardWidth={500}
                    position={fen}
                    onPieceDrop={onPieceDrop}
                    onPieceDragBegin={onPieceDragBegin}
                    onPieceDragEnd={onPieceDragEnd}
                    isDraggablePiece={isDraggablePiece}
                    onSquareClick={onSquareClick}
        />
    </div>
}

export default Game