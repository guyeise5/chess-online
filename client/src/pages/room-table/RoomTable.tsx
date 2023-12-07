import {ReactElement, useEffect, useState} from "react";
import {socketEmit, SocketMessage, socketOff, socketOn} from "../../webSocket/webSocketManager";
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
    if (room.color === 'random') {
        return <BlackWhiteKing/>
    }
    if (room.color == WHITE) {
        return <BlackKing/>
    }
    return <WhiteKing/>
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
    color: Color | "random"
}

function RoomTable(): ReactElement {
    const [rooms, setRooms] = useState<RoomInstanceWebSocketMessage[]>([])

    function onRoomListUpdate(_message: SocketMessage<RoomInstanceWebSocketMessage[]>) {
        axios.get("/api/v2/room/available").then(resp => setRooms(resp.data))
        setRooms(rooms)
    }

    useEffect(() => {
        socketEmit("subscribe", "roomList")
        socketOn("roomListUpdate", onRoomListUpdate)
        axios.get<RoomInstanceWebSocketMessage[]>("/api/v2/room/available")
            .then(resp => setRooms(resp.data))

        return () => {
            socketEmit("unsubscribe", "roomList")
            socketOff(onRoomListUpdate)
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