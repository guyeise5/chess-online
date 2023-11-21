import express from "express";
import cors from "cors";
import auth from "../api/auth";
import path from "path";
import {isProd} from "../utils";
import v1 from "../api/v1";

const clientBuildPath = () => {
    return process.env.CLIENT_BUILD_PATH || path.join(__dirname, "../../client/build")
}
export default () => {
    const app = express()
    console.log(clientBuildPath())
    isProd() || app.use(cors())
    app.use("*", auth)
    app.use("/api/v1", v1)
    app.use(express.static(clientBuildPath()))
    app.use((_req, res) => {
        res.sendFile(clientBuildPath() + "/index.html")
    })
    return app
}