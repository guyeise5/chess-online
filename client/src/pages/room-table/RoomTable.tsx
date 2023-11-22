import {ReactElement, useEffect, useState} from "react";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import axios from "axios";
import { Link } from "react-router-dom";

function buildTablesTrs(roomsIds: string[]): ReactElement[] {
    return roomsIds.map(roomId => <tr>
        <Link to={`/joinRoom?roomId=${roomId}`}>
            <td>{roomId}</td>
        </Link>
    </tr>)
}

function RoomTable(): ReactElement {
    const [rooms, setRooms] = useState<string[]>([])

    function onRoomListUpdate(message: SocketMessage<string[]>) {
        const roomsIds = message.data
        setRooms(roomsIds)
    }

    useEffect(() => {
        socket().emit("subscribe", "room-list")
        socket().on("roomListUpdate", onRoomListUpdate)
        axios.get("/api/v1/room/ids")
            .then(resp => setRooms(resp.data))

        return () => {
            socket().emit("unsubscribe", "room-list")
            socket().off("roomListUpdate", onRoomListUpdate)
        }
    }, []);

    return <div>
        <table>
            <tbody>
            <tr>
                <th>
                    roomId
                </th>
            </tr>
            {buildTablesTrs(rooms)}
            </tbody>
        </table>
    </div>
}


export default RoomTable