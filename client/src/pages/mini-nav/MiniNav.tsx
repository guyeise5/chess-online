import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import axios from "axios";
import {useNavigate} from "react-router-dom";
import {Color} from "chess.js";

const MiniNav = (): ReactElement => {
    const navigate = useNavigate();

    async function createRoomClick() {
        axios.post("/api/v1/room/create", {hidden: false}).then(resp => {
            const data: {color: Color, roomId: string}  = resp.data
            console.log("data", data)
            navigate(`/waitingRoom?roomId=${data.roomId}&color=${data.color}`)

        })
    }

    async function playWithFriend() {
        const resp = await axios.post(`/api/v1/room/create`, {hidden: true})
        const data: { color: Color, roomId: string } = resp.data
        navigate(`/waitingRoom?roomId=${data.roomId}&color=${data.color}`)
    }

    return <div>
        <button className={"center"} onClick={createRoomClick}>Create room</button>
        <button className={"center"} onClick={playWithFriend}>Play with a friend</button>
    </div>
}

export default MiniNav