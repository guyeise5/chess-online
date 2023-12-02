import express from "express";
import bodyParser from 'body-parser'

import {BLACK, Color, Move, WHITE} from "chess.js";
import {
    handleGameOver,
    handleTimersOnTurnSwitch,
    isGameAvailable,
    startGame
} from "../../utils";
import {publish} from "../../servers/webSocketServer";
import {Response} from 'express';
import {ChessRoom, CreateRoomOptions} from "../../stateManager/IStateManager";
import {getPublicAvailableRoomList, roomToWebSocketMessage} from "./utils";
import {dalGameManager, dalRoomManager} from "../../stateManager";
import {RoomDBObject} from "../../stateManager/MongoRoomManager";
import {CreateGameOptions, GameDBObject} from "../../stateManager/MongoGameManager";
import gameManager from "./gameManager";

function roomNotExists(res: Response, roomId: string) {
    res.status(404).json({
        status: 404,
        message: `room ${roomId} not found`
    })
}

const router = express.Router()
router.use(bodyParser.json())
router.use(bodyParser.text())


function registerUserToRoom(room: RoomDBObject, userId: string): Color {
    let userColor: Color;
    if (room.color === WHI) {
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


router.post("/:roomId/join", async (req, res) => {
    const room = await dalRoomManager.getById(req.params.roomId)

    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }

    if (req.userId == room.userId) {
        return res.status(400).json({
            error: "same user"
        })
    }
    const whitePlayerId = room.color == WHITE ? room.userId : room.color == BLACK ? req.userId : Math.random() < 0.5 ? room.userId : req.userId
    const blackPlayerId = room.userId === whitePlayerId ? req.userId : room.userId
    const createGameOptions: CreateGameOptions = {
        pgn: "",
        whitePlayerId: whitePlayerId,
        blackPlayerId: blackPlayerId
    }
    await dalGameManager.create(createGameOptions)
    publish("playerJoined", `room-${room._id}`, "1")
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
    const room = stateManager.getById(req.params.roomId)
    if (!room) {
        return roomNotExists(res, req.params.roomId);
    }
    res.status(200).json({ok: 1})
    // const userId = req.userId
    //
    // if (userId !== room.blackPlayerId && userId !== room.whitePlayerId) {
    //     return
    // }2
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