import {Router} from "express";
import roomManager from "./roomManager";
import puzzles from "./puzzles";
import gameManager from "./gameManager";

const router = Router()
router.use("/room", roomManager)
router.use("/game", gameManager)
router.use('/puzzle', puzzles())
router.use("*", (req,res) => {
    res.status(404).json({
        path: req.originalUrl,
        status: 404,
        message: "NOT_FOUND"
    })
})
export default router