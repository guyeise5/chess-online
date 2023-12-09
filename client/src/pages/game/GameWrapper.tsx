import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import './Game.css'
import {BLACK, Color, WHITE} from "chess.js";
import axios from 'axios'
import {useLocation} from "react-router-dom";
import {socketEmit, SocketMessage, socketOff, socketOn} from "../../webSocket/webSocketManager";
import {getGameTopicName} from "./utils";
import Game from "./Game";

type RoomTimesResponse = {
    whitePlayerSeconds: number
    blackPlayerSeconds: number
    incrementSeconds: number
}
export type GameDBObject = Readonly<{
    _id: string
    sourceRoomId: string
    whitePlayerId: string
    blackPlayerId: string
    pgn: string
    currentPlayerToPlay: Color
    whitePlayerTimeSeconds: number
    blackPlayerTimeSeconds: number
    incSeconds: number
    over: boolean
}>
const GameWrapper = (): ReactElement => {
    const checkmateSound = useMemo(() => new Audio("./mp3/checkmate.mp3"), [])
    const {search} = useLocation()
    const params = useMemo(() => new URLSearchParams(search), [search])
    const [myColor, setMyColor] = useState<Color>()
    const gameId = useMemo(() => params.get("gameId"), [params])
    const topicName = useMemo(() => getGameTopicName(gameId || ""), [gameId])
    const [myTime, setMyTime] = useState<number | null>(null)
    const [opponentTime, setOpponentTime] = useState<number | null>(null)
    const [pgn, setPgn] = useState<string>()
    const [isOver, setIsOver] = useState<boolean>(false)
    const [currentTurn, setCurrentTurn] = useState<Color>()
    const clockTickInterval = useRef<NodeJS.Timer>()
    const clockTimesFetchInterval = useRef<NodeJS.Timer>()
    useEffect(() => {
        axios.get(`/api/v2/game/${gameId}/myColor`)
            .then(resp => {
                setMyColor(resp.data)
                console.log(`setting my color to ${resp.data}`)
            })
            .catch(e => console.error(e))
    }, []);

    function fetchTimesFromServer() {
        axios.get<RoomTimesResponse>(`/api/v2/game/${gameId}/times`).then(resp => {
            const data = resp.data
            setMyTime(myColor == BLACK ? data.blackPlayerSeconds : data.whitePlayerSeconds)
            setOpponentTime(myColor == BLACK ? data.whitePlayerSeconds : data.blackPlayerSeconds)
        })
    }

    function clockTick(deltaSeconds: number) {
        if (currentTurn == myColor) {
            setMyTime(v => v && Math.max(0, v - deltaSeconds))
        } else {
            setOpponentTime(v => v && Math.max(0, v - deltaSeconds))
        }
    }

    useEffect(() => {
        clearInterval(clockTickInterval.current)
        if (isOver) {
            return;
        }
        const ms = 100
        clockTickInterval.current = setInterval(() => clockTick(ms / 1000), ms)
        return () => clearInterval(clockTickInterval.current)
    }, [isOver, currentTurn, myColor]);

    useEffect(() => {
        clearInterval(clockTimesFetchInterval.current)
        if (isOver) {
            return
        }
        fetchTimesFromServer()
        clockTimesFetchInterval.current = setInterval(fetchTimesFromServer, 5000)
        return () => clearInterval(clockTimesFetchInterval.current)
    }, [myColor, isOver]);

    useEffect(() => {
        if(isOver) {
            clearInterval(clockTimesFetchInterval.current)
            clearInterval(clockTickInterval.current)
        }
    },[isOver])
    // TODO: make the SocketMessage type compatible with the server AKA GameOverReason
    function gameOverListener(message: SocketMessage<{ type: string, winner?: Color, pgn?: string }>) {
        if (message.topic !== topicName) {
            return
        }

        const data = message.data
        setPgn(data.pgn)
        console.log(`Winner is ${data.winner}`)

    }

    function gameDisconnectListener(message: SocketMessage<{ color: Color }>) {
        if (message.topic !== topicName) {
            return
        }

        console.log("game disconnected", message.data.color)

        alert(myColor === message.data.color ? "you are disconnected" : "opponent disconnected")
    }


    function onPgnUpdate(message: SocketMessage<GameDBObject>) {
        const game = message.data
        console.log("pgn update", game)
        if (message.topic !== topicName) {
            return;
        }

        setMyTime(myColor == WHITE ? game.whitePlayerTimeSeconds : game.blackPlayerTimeSeconds)
        setOpponentTime(myColor == WHITE ? game.blackPlayerTimeSeconds : game.whitePlayerTimeSeconds)
        setIsOver(game.over)
        setCurrentTurn(game.currentPlayerToPlay)
        setPgn(game.pgn)
    }

    useEffect(() => {
        socketEmit("subscribe", topicName)
        socketOn("pgn_update", onPgnUpdate)
        socketOn("gameDisconnect", gameDisconnectListener)
        socketOn("gameOver", gameOverListener)

        return () => {
            socketEmit("unsubscribe", topicName)
            socketOff(onPgnUpdate)
            socketOff(gameDisconnectListener)
            socketOff(gameOverListener)
        }
    }, []);

    useEffect(() => {
        axios.get(`/api/v2/game/${gameId}`).then(resp => {
            setPgn(resp.data.pgn)
            setIsOver(resp.data.over)
            setCurrentTurn(resp.data.currentPlayerToPlay)
        })
    }, []);

    useEffect(() => {
        if (isOver) {
            checkmateSound.play().finally()
        }
    }, [pgn])
    if (!gameId || pgn === undefined || !myColor || !myTime || !opponentTime) {
        return <div></div>
    }
    return <div id={"mainGameDiv"}>
        <Game gameId={gameId} pgn={pgn} color={myColor} myTime={myTime} opponentTime={opponentTime}/>
    </div>
}

export default GameWrapper