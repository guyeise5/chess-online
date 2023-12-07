import express from "express";
import bodyParser from 'body-parser'

import {BLACK, WHITE} from "chess.js";
import {Response} from 'express';
import {getPublicAvailableRoomList, roomToWebSocketMessage} from "./utils";
import {dalGameManager, dalRoomManager} from "../../stateManager";
import {CreateGameOptions} from "../../stateManager/MongoGameManager";
import {CreateRoomOptions} from "../../stateManager/MongoRoomManager";

function roomNotExists(res: Response, roomId: string) {
    res.status(404).json({
        status: 404,
        message: `room ${roomId} not found`
    })
}

const router = express.Router()
router.use(bodyParser.json())
router.use(bodyParser.text())


router.post("/:roomId/join", async (req, res) => {
    const roomId = req.params.roomId;
    const room = await dalRoomManager.getById(roomId)

    if (!room) {
        return roomNotExists(res, roomId);
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
        sourceRoomId: roomId,
        whitePlayerId: whitePlayerId,
        blackPlayerId: blackPlayerId,
        timeMinutes: room.timeMinutes || Infinity,
        incSeconds: room.incrementSeconds
    }

    const gameId = await dalGameManager.create(createGameOptions)
    res.status(200).json({gameId: gameId})
    dalRoomManager.delete(roomId).finally()
    return
})


router.post("/create", async (req, res) => {
    const options: CreateRoomOptions & {userId: string} = {...req.body, userId: req.userId}
    const roomId = await dalRoomManager.create(options)
    res.status(200).json({roomId: roomId})
    return
})


router.get("/available", async (req, res) => {
    res.status(200).json((await getPublicAvailableRoomList(req.userId)).map(roomToWebSocketMessage))
})

router.post('/:roomId/heartbeat', (_req, res) => {
    res.status(200).json({ok: 1})
})

export default router