import {io, Socket} from 'socket.io-client';

let _socket: Socket | undefined = undefined

const init = (): Socket => {
    if (!_socket) {
        _socket = io()
        _socket.on("connect", () => {
            console.log("web socket connected")
        })
    }

    return _socket
}

export function socket(): Socket {
    return init()
}