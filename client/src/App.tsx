import './App.css';
import { io } from 'socket.io-client';
import {useEffect} from "react";

function App() {
    useEffect(() => {
        const socket = io()
        socket.on("connect", () => {
            console.log("connected")
        })
        socket.on("message", message => {
            console.log("ws", message)
        })

        socket.emit("message", "hello")
        socket.emit("subscribe", "room-2")
    }, []);

    return (
    <div className="App">
      hello
    </div>
  );
}

export default App;
