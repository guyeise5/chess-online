import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import axios from "axios";
import {useNavigate} from "react-router-dom";
import {Color} from "chess.js";

const MiniNav = (): ReactElement => {
    const navigate = useNavigate();

    async function quickPlayClick() {
        const resp = await axios.post("/api/v1/room/quickPlay")
        const data: {
            color: string,
            roomId: string
        } = resp.data

        navigate(`/room?roomId=${data.roomId}&color=${data.color}`)
    }


    async function createGameClick() {
        const resp = await axios.post(`/api/v1/room/create`)
        const data: { color: Color, roomId: string } = resp.data
        navigate(`/waitingRoom?roomId=${data.roomId}&color=${data.color}`)
    }

    return <div>
        <button id={"quickPairButton"} className={"center"} onClick={quickPlayClick}>Quick pairing</button>
        <button id={"createGame"} className={"center"} onClick={createGameClick}>Create game</button>
    </div>
}

export default MiniNav