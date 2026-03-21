import { io, Socket } from "socket.io-client";

const URL = import.meta.env.PROD ? window.location.origin : "http://localhost:3001";

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});
