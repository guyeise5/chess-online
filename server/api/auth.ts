import {Router} from "express";
import {v4} from "uuid"
import cookieParser from 'cookie-parser'

declare global {
    namespace Express {
        export interface Request {
            userId: string
        }
    }
}

const router = Router()
router.use(cookieParser());

router.use("*", (req, res, next) => {
    let userId = req.cookies.userId
    if (!userId) {
        userId = v4()
        res.cookie("userId", userId)
    }
    req.userId = userId;
    return next()
})
export default router