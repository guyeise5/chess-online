import http from 'http'
import restServer from "./servers/restServer";
import {webSocketRegisterTo} from "./servers/webSocketServer";
import initSubscribers from "./stateManager/Subscribers";

const PORT = Number(process.env.PORT) || 8080
const app = restServer()

const server = http.createServer(app)
webSocketRegisterTo(server)
initSubscribers()
server.listen(PORT, () => console.log(`app is listening on port ${PORT}`))