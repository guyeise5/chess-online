import {Response, Router} from "express";
import bodyParser from "body-parser";
import {dalGameManager} from "../../stateManager";
import {BLACK, Chess, Move, WHITE} from "chess.js";
import {handleGameOverIfNeeded} from "../../utils";
import {toMinimalGame} from "./utils";

const router: Router = Router()
router.use(bodyParser.json())
router.use(bodyParser.text())

function gameNotFound(res: Response, gameId: string) {
    return res.status(404).json({
        status: 404,
        message: `game ${gameId} not found`
    })
}
router.get("/:gameId", async (req,res) => {
    const gameId = req.params.gameId
    const game = await dalGameManager.getById(gameId);
    if (!game) {
        return gameNotFound(res, gameId)
    }

    return res.status(200).json(toMinimalGame(game))
})
router.get("/:gameId/pgn", async (req, res) => {
    const gameId = req.params.gameId
    const game = await dalGameManager.getById(gameId);
    if (!game) {
        return gameNotFound(res, gameId)
    }

    return res.status(200).json({
            pgn: game.pgn
        }
    )
})

router.get("/:gameId/myColor", async (req, res) => {
    const gameId = req.params.gameId
    const game = await dalGameManager.getById(gameId);
    if (!game) {
        return gameNotFound(res, gameId)
    }

    if (game.whitePlayerId === req.userId) {
        return res.status(200).json(WHITE)
    } else if (game.blackPlayerId === req.userId) {
        return res.status(200).json(BLACK)
    } else {
        return res.status(400).json("you are not part of the game")
    }
})

router.get("/:gameId/turn", async (req,res) => {
    const gameId = req.params.gameId
    const game = await dalGameManager.getById(gameId)
    if(!game) {
        return gameNotFound(res, gameId)
    }
    return res.status(200).json({
        turn: game.currentPlayerToPlay
    })
})
router.post("/:gameId/move", async (req, res): Promise<void> => {
    const gameId = req.params.gameId;
    const game = await dalGameManager.getById(gameId)

    if (!game) {
        gameNotFound(res, gameId);
        return
    }

    // Checking the game is over
    if (game.over) {
        res.status(400).json("game is over")
        return;
    }
    const userId = req.userId

    if (game.whitePlayerId != userId && game.blackPlayerId != userId) {
        res.status(403).json("not part of the game")
        return
    }
    const chess = new Chess()
    chess.loadPgn(game.pgn)
    const turn = chess.turn()

    if ((turn == WHITE && game.whitePlayerId != userId) || (turn == BLACK && game.blackPlayerId != userId)) {
        res.status(403).json("not your turn")
        return;
    }

    const move: { from: string, to: string, promotion?: string } = req.body
    let chessMove: Move;
    try {
        chessMove = chess.move(move);
    } catch (e) {
        res.status(400).json(e)
        return;
    }
    res.status(201).json(chessMove)

    // Todo: merge those queries
    await dalGameManager.incTime(gameId, chessMove.color).finally()
    await dalGameManager.updatePgn(gameId, chess).catch(e => console.error(e))
    handleGameOverIfNeeded(gameId, chess)
})
type GameTimesResponse = {
    whitePlayerSeconds: number | null
    blackPlayerSeconds: number | null
    incrementSeconds: number
}

router.get(`/:gameId/times`, async (req, res) => {
    const gameId = req.params.gameId;
    const game = await dalGameManager.getById(gameId)
    if (!game) {
        return gameNotFound(res, gameId);
    }

    const responseData: GameTimesResponse = {
        whitePlayerSeconds: game.whitePlayerTimeSeconds,
        blackPlayerSeconds: game.blackPlayerTimeSeconds,
        incrementSeconds: game.incSeconds
    }

    return res.status(200).json(responseData)

})

export default router