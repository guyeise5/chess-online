import http from "http";
import socketio from "socket.io";
import {isProd} from "../utils";

let io: socketio.Server | undefined;
export const webSocketRegisterTo = (server: http.Server): void => {
    if (io) {
        throw new Error("server is already created")
    }

    io = new socketio.Server(server, {
        cors: {
            origin: isProd() ? undefined : "*"
        }
    })
    io.on("connection", (socket) => {
        console.log(`new connection ${socket.handshake.address}`)
        socket.on("message", message => console.log(message))

        socket.on("subscribe", (topic, ack) => {
            socket.join(topic)
            if(ack) {
                ack("ok")
            }
            console.log(`new listener for topic ${topic}`)
        })

        socket.on("unsubscribe", (topic, ack) => {
            socket.leave(topic)
            if(ack) {
                ack("ok")
            }
            console.log(`leaver from topic ${topic}`)

        })
    })
}

export const publish = (type: string, topic: string, data: any): void => {
    io?.to(topic).emit(type, {
        topic: topic,
        data: data
    })
}

export function deleteTopic(topic: string) {
    io?.socketsLeave(topic)
}