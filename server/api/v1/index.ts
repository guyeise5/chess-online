import {Router} from "express";
import roomManager from "./roomManager";
import puzzles from "./puzzles";
import {puzzleDisabled} from "../../config";

const router = Router()
router.use("/room", roomManager)
puzzleDisabled || router.use('/puzzle', puzzles())
router.use("*", (req,res) => {
    res.status(404).json({
        path: req.originalUrl,
        status: 404,
        message: "NOT_FOUND"
    })
})
export default router