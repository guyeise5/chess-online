import {io, Socket} from 'socket.io-client';

let _socket: Socket | undefined = undefined

const init = () => {
    if (_socket) {
        return
    }
    _socket = io()
    _socket.on("connect", () => {
        console.log("web socket connected")
    })
}

export function socket() {
    init()
    return _socket
}