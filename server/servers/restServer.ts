import express from "express";
import cors from "cors";
import auth from "../routes/auth";
import path from "path";
import roomManager from "../routes/roomManager";

const clientBuildPath = () => {
    return process.env.CLIENT_BUILD_PATH || path.join(__dirname, "../../client/build")
}
export default () => {
    const app = express()
    console.log(clientBuildPath())
    app.use(cors())
    app.use("*", auth)
    app.use("/api/v1/room", roomManager)
    app.use(express.static(clientBuildPath()))
    app.use((_req,res) => {
        res.sendFile(clientBuildPath() + "/index.html")
    })
    return app
}