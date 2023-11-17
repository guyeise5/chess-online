import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import axios from "axios";
import {useNavigate} from "react-router-dom";


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

    return <div>
        <button id={"quickPairButton"} className={"center"} onClick={quickPlayClick}>Quick pairing</button>
        <button id={"lobbyButton"} className={"center"}>Create game</button>
    </div>
}

export default MiniNav