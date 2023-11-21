import {Router} from "express";
import roomManager from "./roomManager";

const router = Router()
router.use("/room", roomManager)
router.use("*", (req,res) => {
    res.status(404).json({
        path: req.originalUrl,
        status: 404,
        message: "NOT_FOUND"
    })
})
export default router