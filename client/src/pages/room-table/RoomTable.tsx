import {ReactElement, useEffect, useState} from "react";
import {socket, SocketMessage} from "../../webSocket/webSocketManager";
import axios from "axios";
import {Link} from "react-router-dom";
import {Color, WHITE} from "chess.js";
import {ReactComponent as WhiteKing} from '../../img/wK.svg'
import {ReactComponent as BlackKing} from '../../img/bK.svg'
import {ReactComponent as BlackWhiteKing} from '../../img/wbK.svg'
import {formatTime} from "../clock/utils";

function displayTime(seconds: number | null, increment: number): string {
    if (!seconds) {
        return "unlimited"
    }
    return `${formatTime(seconds)}+${increment}`
}

function getLogoImage(room: RoomInstanceWebSocketMessage): ReactElement {
    if (room.randomChoice) {
        return <BlackWhiteKing/>
    }
    if (room.color == WHITE) {
        return <WhiteKing/>
    }
    return <BlackKing/>
}

function buildTablesTrs(rooms: RoomInstanceWebSocketMessage[]): ReactElement[] {
    return rooms.map(room => <tr>
            <Link to={`/joinRoom?roomId=${room.roomId}`}>
                <td>
                    {getLogoImage(room)}
                </td>
                <td>
                    {room.name}
                </td>
                <td>
                    {displayTime(room.timeSeconds, room.incSeconds)}
                </td>
            </Link>
        </tr>
    )
}

type RoomInstanceWebSocketMessage = {
    name: string,
    roomId: string,
    timeSeconds: number | null,
    incSeconds: number,
    color: Color,
    randomChoice: boolean
}

function RoomTable(): ReactElement {
    const [rooms, setRooms] = useState<RoomInstanceWebSocketMessage[]>([])

    function onRoomListUpdate(message: SocketMessage<RoomInstanceWebSocketMessage[]>) {
        const rooms = message.data
        setRooms(rooms)
    }

    useEffect(() => {
        socket().emit("subscribe", "room-list")
        socket().on("roomListUpdate", onRoomListUpdate)
        axios.get("/api/v1/room/available")
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
                    color
                </th>
                <th>
                    name
                </th>
                <th>
                    time
                </th>
            </tr>
            {buildTablesTrs(rooms)}
            </tbody>
        </table>
    </div>
}


export default RoomTable