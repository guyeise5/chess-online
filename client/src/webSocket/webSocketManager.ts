import {io, Socket} from 'socket.io-client';
import {webSocketOrigin} from "../config";

let _socket: Socket | undefined = undefined

export type SocketMessage<T> = { topic: string, data: T }
const init = (): Socket => {
    if (!_socket) {
        const wsOrigin = webSocketOrigin();
        if(wsOrigin) {
            _socket = io(wsOrigin)
        } else {
            _socket = io()
        }
        _socket.on("connect", () => {
            console.log("web socket connected")
        })
    }

    return _socket
}

export function socket(): Socket {
    return init()
}