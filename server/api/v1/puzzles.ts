import {Router} from "express";
import {puzzleDal} from "../../dal";
export default function (): Router {
    const router = Router()
    router.get("/:id", async (req, res) => {
        const maybePuzzle = await puzzleDal().getPuzzleById(req.params.id)
        if (maybePuzzle) {
            return res.status(200).json(maybePuzzle)
        }

        return res.status(404).json({
            error: `puzzle ${req.params.id} not found`
        })
    })

    router.get("/byRating/:rating", async (req, res) => {
        const rate = Number(req.params.rating)
        if (!rate) {
            return res.status(400).json({
                error: "rating must be a number"
            })
        }

        const maybePuzzle = await puzzleDal().getPuzzleByRating(rate)
        if (maybePuzzle) {
            return res.status(200).json(maybePuzzle)
        }

        return res.status(404).json({
            error: `could not found puzzle for rating ${rate}`
        })


    })
    return router
}