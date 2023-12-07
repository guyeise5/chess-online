import {io, Socket} from 'socket.io-client';
import {webSocketOrigin} from "../config";

let _socket: Socket | undefined = undefined

export type SocketMessage<T> = { topic: string, data: T }
const socket = (): Socket => {
    if (!_socket) {
        const wsOrigin = webSocketOrigin();
        if (wsOrigin) {
            _socket = io(wsOrigin)
        } else {
            _socket = io()
        }
        _socket.on("connect", () => {
            console.log("web socket connected")
        })

        _socket.on("disconnect", () => {
        })
    }

    return _socket
}

export function socketOn(type: string, listener: (message: WebSocketMessage) => void) {
    socket().on("message", (message: WebSocketMessage) => {
        console.log("ws message", message)
        if (message.type === type) {
            listener(message)
        }
    })
}

export function socketOff(listener: (message: WebSocketMessage) => void) {
    socket().off("message", listener)
}

export function socketEmit(type: string, message: any) {
    socket().emit(type, message)
}

export function socketEmitWithAck(type: string, message: any): Promise<void> {
    return socket().emitWithAck(type, message)
}

type WebSocketMessage = {
    topic: string,
    data: any,
    type: string
}