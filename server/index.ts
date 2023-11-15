import http from 'http'
import restServer from "./servers/restServer";
import {webSocketRegisterTo} from "./servers/webSocketServer";

const PORT = Number(process.env.PORT) || 8080
const app = restServer()

const server = http.createServer(app)
webSocketRegisterTo(server)
server.listen(PORT, () => console.log(`app is listening on port ${PORT}`))