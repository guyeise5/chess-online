import express from "express";
import cors from "cors";
import auth from "../routes/auth";
import path from "path";
import roomManager from "../routes/roomManager";


export default () => {
    const app = express()
    app.use(cors())
    app.use("*", auth)
    app.use(express.static(path.join(__dirname, "../../client/build")))
    app.use("/room", roomManager)
    return app
}