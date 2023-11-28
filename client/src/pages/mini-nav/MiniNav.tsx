import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import axios from "axios";
import {useNavigate} from "react-router-dom";
import {Color} from "chess.js";
import { SlPuzzle } from "react-icons/sl";
import { LiaUserFriendsSolid } from "react-icons/lia";
import { LiaChessSolid } from "react-icons/lia";


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

    function puzzles() {
        navigate("/puzzle")
    }
    return <div>
        <button className={"center"} onClick={createRoomClick}><LiaChessSolid/> Create room</button>
        <button className={"center"} onClick={playWithFriend}><LiaUserFriendsSolid/> Play with a friend</button>
        <button className={"center"} onClick={puzzles}><SlPuzzle/> Puzzles</button>
    </div>
}

export default MiniNav