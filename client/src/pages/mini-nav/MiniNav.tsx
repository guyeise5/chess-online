import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import {useNavigate} from "react-router-dom";
import {SlPuzzle} from "react-icons/sl";
import {LiaUserFriendsSolid} from "react-icons/lia";
import {LiaChessSolid} from "react-icons/lia";
import { BiSolidChess } from "react-icons/bi";
import { FaRegChessKnight } from "react-icons/fa6";


const MiniNav = (): ReactElement => {
    const navigate = useNavigate();

    function lobbyClick() {
        navigate("/lobby")
    }
    function createRoomClick() {
        navigate("/createRoom")
    }

    function playWithFriend() {
        navigate("/createRoom?hidden=true")
    }

    function puzzles() {
        navigate("/puzzle")
    }

    function quickPlay() {
        navigate("/quickPlay")
    }

    return <div className={"MiniNavContainer"}>
        <button disabled={true} className={"navElement"} onClick={quickPlay}><FaRegChessKnight/> Quick play</button>
        <button className={"navElement"} onClick={lobbyClick}><BiSolidChess/> Lobby</button>
        <button className={"navElement"} onClick={createRoomClick}><LiaChessSolid/> Create room</button>
        <button className={"navElement"} onClick={playWithFriend}><LiaUserFriendsSolid/> Play with a friend</button>
        <button className={"navElement"} onClick={puzzles}><SlPuzzle/> Puzzles</button>
    </div>
}

export default MiniNav