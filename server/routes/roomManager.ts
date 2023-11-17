import express from "express";
import bodyParser from 'body-parser'

import sm from "../stateManager";
import {BLACK, WHITE} from "chess.js";
import {isGameAvailable, toSquare} from "../utils";
import {publish} from "../servers/webSocketServer";
import {ChessRoom} from "../stateManager/IStateManager";

const router = express.Router()
router.use(bodyParser.json())
router.use(bodyParser.text())
router.get("/:roomId/board", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    res.status(200).json(chess.board().flatMap(x => x).filter(Boolean))
})
router.get("/:roomId/turn", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    res.status(200).json(chess.turn())
})
router.get("/:roomId/moves", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    const square = toSquare(req.query.square?.toString())
    if(square) {
        res.status(200).json(chess.moves({square: square, verbose: true}))
    } else {
        res.status(200).json(chess.moves({verbose: true}))

    }
})
router.get("/:roomId/gameState", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    res.status(200).json({
        isGameOver: chess.isGameOver()
        // winner: chess.
    })
})
router.get("/:roomId/fen", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    res.status(200).json(chess.fen())
})
router.get("/:roomId/ascii", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    res.status(200).json(chess.ascii())
})
router.post("/:roomId/loadFen", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    try {
        chess.load(req.body)
        res.status(201).json(chess.fen())
    } catch (e) {
        res.status(400).json(e)
    }
})

router.get("/:roomId/myColor", (req,res) => {
    const room = sm.getOrCreateRoom(req.params.roomId)
    if(room.whitePlayerId === req.userId) {
        res.status(200).json(WHITE)
    } else if(room.blackPlayerId === req.userId) {
        res.status(200).json(BLACK)
    } else {
        res.status(400).json("you are not part of the game")
    }
})
router.post("/:roomId/loadPgn", (req, res) => {
    const chess = sm.getOrCreateRoom(req.params.roomId).chess
    try {
        chess.loadPgn(req.body)
        res.status(201).json(chess.fen())
    } catch (e) {
        res.status(400).json(e)
    }
})

router.post("/quickPlay", (req,res) => {
    const room = sm.getOrCreateQuickRoom()
    const userColor = registerUserToRoom(room, req.userId)
    res.status(200).json({
        color: userColor,
        roomId: room.id
    })

})

function registerUserToRoom(room: ChessRoom, userId: string): string {
    let userColor: string;
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
    const room = sm.getOrCreateRoom(req.params.roomId)

    if (room.blackPlayerId && room.whitePlayerId) {
        res.status(400).json({
            error: "room is full"
        })
        return
    }
    let userColor = registerUserToRoom(room, req.userId);

    res.status(200).json(userColor)
    return
})

router.post("/:roomId/move", (req, res) => {
    const roomId = req.params.roomId;
    const room = sm.getOrCreateRoom(roomId)

    // Checking the game is available
    if (!isGameAvailable(room)) {
        res.status(400).json("game not available")
        return;
    }

    const turn = room.chess.turn()
    const userId = req.userId

    if ((turn == WHITE && room.whitePlayerId != userId) || (turn == BLACK && room.blackPlayerId != userId)) {
        res.status(403).json("not your turn")
    }

    const move: {from: string, to: string, promotion?: string} = req.body
    try {
        const chessMove = room.chess.move(move);
        res.status(201).json(chessMove)
        publish(`room-${roomId}`, room.chess.fen())
        console.log(`#${roomId} - move`, move)
    } catch (e) {
        res.status(400).json(e)
    }
})

export default router