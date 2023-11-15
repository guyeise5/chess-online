import http from "http";
import socketio from "socket.io";

let io: socketio.Server | undefined;
export const webSocketRegisterTo = (server: http.Server): void => {
    if (io) {
        throw new Error("server is already created")
    }
    io = new socketio.Server(server)
    io.on("connection", (socket) => {
        console.log(`new connection ${socket.handshake.address}`)
        socket.on("message", message => console.log(message))

        socket.on("subscribe", topic => {
            socket.join(topic)
            console.log(`new listener for topic ${topic}`)
        })

        socket.on("unsubscribe", topic => {
            socket.leave(topic)
            console.log(`leaver from topic ${topic}`)
        })
    })
}

export const publish = (topic: string, message: any): void => {
    io?.to(topic).emit("message", {
        topic: topic,
        message: message
    })
}
