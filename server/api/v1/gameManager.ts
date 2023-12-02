import {Response, Router} from "express";
import bodyParser from "body-parser";
import {dalGameManager} from "../../stateManager";
import {BLACK, WHITE} from "chess.js";

const router: Router = Router()
router.use(bodyParser.json())
router.use(bodyParser.text())

function gameNotFound(res: Response, gameId: string) {
    return res.status(404).json({
        status: 404,
        message: `game ${gameId} not found`
    })
}

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

export default router