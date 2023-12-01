import express from "express";
import bodyParser from 'body-parser'

import sm from "../../stateManager";
import {BLACK, Color, Move, WHITE} from "chess.js";
import {
    handleGameOver,
    handleTimersOnTurnSwitch,
    isGameAvailable,
    startGame, /*isPlayerDisconnected, shutdownGame,*/
    toSquare
} from "../../utils";
import {publish} from "../../servers/webSocketServer";
import {Response} from 'express';
import {ChessRoom, CreateRoomOptions} from "../../stateManager/IStateManager";
import stateManager from "../../stateManager";
import {getPublicAvailableRoomList, roomToWebSocketMessage} from "./utils";

function roomNotExists(res: Response, roomId: string) {
    res.status(404).json({
        status: 404,
        message: `room ${roomId} not found`
    })
}

const router = express.Router()
router.use(bodyParser.json())
router.use(bodyParser.text())
router.get("/:roomId/board", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    res.status(200).json(chess.board().flatMap(x => x).filter(Boolean))
})
router.get("/:roomId/turn", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    res.status(200).json(chess.turn())
})
router.get("/:roomId/moves", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    const square = toSquare(req.query.square?.toString())
    if (square) {
        res.status(200).json(chess.moves({square: square, verbose: true}))
    } else {
        res.status(200).json(chess.moves({verbose: true}))

    }
})
router.get("/:roomId/gameState", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    res.status(200).json({
        isGameOver: chess.isGameOver()
        // winner: chess.
    })
})
router.get("/:roomId/fen", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    res.status(200).json(chess.fen())
})
router.get("/:roomId/ascii", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    res.status(200).json(chess.ascii())
})
router.post("/:roomId/loadFen", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    try {
        chess.load(req.body)
        res.status(201).json(chess.fen())
    } catch (e) {
        res.status(400).json(e)
    }
})

router.get("/:roomId/myColor", (req, res) => {
    const room = sm.getRoom(req.params.roomId)
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    if (room.whitePlayerId === req.userId) {
        res.status(200).json(WHITE)
    } else if (room.blackPlayerId === req.userId) {
        res.status(200).json(BLACK)
    } else {
        res.status(400).json("you are not part of the game")
    }
})
router.post("/:roomId/loadPgn", (req, res) => {
    const room = sm.getRoom(req.params.roomId);
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    const chess = room.chess
    try {
        chess.loadPgn(req.body)
        res.status(201).json(chess.fen())
    } catch (e) {
        res.status(400).json(e)
    }
})

function registerUserToRoom(room: ChessRoom, userId: string): Color {
    let userColor: Color;
    if (room.blackPlayerId) {
        userColor = WHITE
    } else if (room.whitePlayerId) {
        userColor = BLACK
    } else {
        userColor = Math.random() < 0.5 ? WHITE : BLACK
    }

    if (userColor == WHITE) {
        room.whitePlayerId = userId
    } else {
        room.blackPlayerId = userId
    }
    return userColor;
}


router.post("/:roomId/join", (req, res) => {
    const room = sm.getRoom(req.params.roomId)

    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }

    if (room.blackPlayerId && room.whitePlayerId) {
        res.status(400).json({
            error: "room is full"
        })
        return
    }
    let userColor = registerUserToRoom(room, req.userId);

    res.status(200).json(userColor)
    publish("playerJoined", `room-${room.id}`, "1")
    publishAvailableRoomList()
    startGame(room)
    return
})

type CreateRoomResponseData = {
    color: Color,
    roomId: string,
    totalTimeSeconds: number | null,
    incrementTimeSeconds: number
}

type RoomTimesResponse = {
    whitePlayerSeconds: number | null
    blackPlayerSeconds: number | null
    incrementSeconds: number
}
router.get(`/:roomId/times`, (req, res) => {
    const roomId = req.params.roomId;
    const room = sm.getRoom(roomId)
    if (!room) {
        return roomNotExists(res, roomId);
    }

    const responseData: RoomTimesResponse = {
        whitePlayerSeconds: room.whitePlayerSeconds,
        blackPlayerSeconds: room.blackPlayerSeconds,
        incrementSeconds: room.incSeconds
    }

    res.status(200).json(responseData)

})

function publishAvailableRoomList() {
    publish("roomListUpdate", "room-list", getPublicAvailableRoomList().map(roomToWebSocketMessage))
}

router.post("/create", (req, res) => {
    const options: CreateRoomOptions = {...req.body, userId: req.userId}
    const room = sm.createRoom(options)
    const responseData: CreateRoomResponseData = {
        color: (room.blackPlayerId && BLACK) || WHITE,
        roomId: room.id,
        totalTimeSeconds: room.whitePlayerSeconds,
        incrementTimeSeconds: room.incSeconds
    }
    res.status(200).json(responseData)
    publishAvailableRoomList();
    return
})


router.post("/:roomId/move", (req, res) => {
    const roomId = req.params.roomId;
    const room = sm.getRoom(roomId)

    if (!room) {
        return roomNotExists(res, roomId);
    }

    // Checking the game is available
    if (!isGameAvailable(room)) {
        res.status(400).json("game not available")
        return;
    }

    const turn = room.chess.turn()
    const userId = req.userId

    if (room.whitePlayerId != userId && room.blackPlayerId != userId) {
        res.status(403).json("not part of the game")
        return
    }
    if ((turn == WHITE && room.whitePlayerId != userId) || (turn == BLACK && room.blackPlayerId != userId)) {
        res.status(403).json("not your turn")
        return;
    }

    const move: { from: string, to: string, promotion?: string } = req.body
    let chessMove: Move;
    try {
        chessMove = room.chess.move(move);
    } catch (e) {
        res.status(400).json(e)
        return;
    }

    res.status(201).json(chessMove)
    publish("move", `room-${roomId}`, chessMove)
    if (room.chess.isGameOver()) {
        handleGameOver(room)
    }
    handleTimersOnTurnSwitch(room)
    console.log(`#${roomId} - move`, move)
})

router.get("/available", (_req, res) => {
    res.status(200).json(getPublicAvailableRoomList().map(roomToWebSocketMessage))
})

router.post('/:roomId/heartbeat', (req, res) => {
    const room = stateManager.getRoom(req.params.roomId)
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    res.status(200).json({ok: 1})
    // const userId = req.userId
    //
    // if (userId !== room.blackPlayerId && userId !== room.whitePlayerId) {
    //     return
    // }
    //
    // stateManager.recordClientHeartbeat(req.userId)
    //
    // if (!room.whitePlayerId || !room.blackPlayerId) {
    //     return
    // }
    //
    // const [blackPlayerStatus, whitePlayerStatus] = stateManager.getClientsStatus(room.blackPlayerId, room.whitePlayerId)
    //
    // if (isPlayerDisconnected(blackPlayerStatus)) {
    //     publish("gameDisconnect", `room-${room.id}`, {
    //         color: BLACK
    //     })
    //     shutdownGame(room.id)
    //     return;
    // }
    //
    // if (isPlayerDisconnected(whitePlayerStatus)) {
    //     publish("gameDisconnect", `room-${room.id}`, {
    //         color: WHITE
    //     })
    //     shutdownGame(room.id)
    //     return;
    // }
})

export default router