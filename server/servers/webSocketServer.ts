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
            console.log(`new listener for topic ${topic}`)
            socket.join(topic)
            if (ack) {
                ack("ok")
            }
            onSubscriptionListeners.forEach(f => f(topic))
        })

        socket.on("unsubscribe", (topic, ack) => {
            console.log(`leaver from topic ${topic}`)
            socket.leave(topic)
            if (ack) {
                ack("ok")
            }

            onUnSubscriptionListeners.forEach(f => f(topic))
        })
    })
}

export const publish = (type: string, topic: string, data: any): void => {
    console.log("publishing", type, topic, data)
    io?.to(topic).emit("message", {
        topic: topic,
        data: data,
        type: type
    })
}

type SubscriptionListener = (topic: string) => any
const onSubscriptionListeners = new Set<SubscriptionListener>()
const onUnSubscriptionListeners = new Set<SubscriptionListener>()

export function onSubscription(f: SubscriptionListener) {
    onSubscriptionListeners.add(f)
}

export function onUnSubscription(f: SubscriptionListener) {
    onUnSubscriptionListeners.add(f)
}

export function offSubscription(f: SubscriptionListener) {
    onSubscriptionListeners.delete(f)
}

export function offUnSubscription(f: SubscriptionListener) {
    onUnSubscriptionListeners.delete(f)
}


export function deleteTopic(topic: string) {
    io?.socketsLeave(topic)
}