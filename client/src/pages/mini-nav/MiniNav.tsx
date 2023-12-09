import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import {useNavigate} from "react-router-dom";
import {SlPuzzle} from "react-icons/sl";
import {LiaUserFriendsSolid} from "react-icons/lia";
import {LiaChessSolid} from "react-icons/lia";
import { BiSolidChess } from "react-icons/bi";
import { SlCup } from "react-icons/sl";



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

    // function quickPlay() {
    //     navigate("/quickPlay")
    // }

    function myGames() {
        navigate("/myGames")
    }

    return <div className={"MiniNavContainer"}>
        {/*<span disabled={true} className={"navElement"} onClick={quickPlay}><FaRegChessKnight/> Quick play</span>*/}
        <span className={"navElement"} onClick={lobbyClick}><SlCup /> Lobby</span>
        <span className={"navElement"} onClick={createRoomClick}><LiaChessSolid/> Create room</span>
        <span className={"navElement"} onClick={playWithFriend}><LiaUserFriendsSolid/> Play with a friend</span>
        <span className={"navElement"} onClick={puzzles}><SlPuzzle/> Puzzles</span>
        <span className={"navElement"} onClick={myGames}><BiSolidChess/> My open games</span>
    </div>
}

export default MiniNav