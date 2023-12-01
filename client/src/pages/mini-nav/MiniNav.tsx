import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'
import {useNavigate} from "react-router-dom";
import {SlPuzzle} from "react-icons/sl";
import {LiaUserFriendsSolid} from "react-icons/lia";
import {LiaChessSolid} from "react-icons/lia";


const MiniNav = (): ReactElement => {
    const navigate = useNavigate();

    async function createRoomClick() {
        navigate("/createRoom")
    }

    async function playWithFriend() {
        navigate("/createRoom?hidden=true")
    }

    function puzzles() {
        navigate("/puzzle")
    }

    return <div>
        <button className={"navElement"} onClick={createRoomClick}><LiaChessSolid/> Create room</button>
        <button className={"navElement"} onClick={playWithFriend}><LiaUserFriendsSolid/> Play with a friend</button>
        <button className={"navElement"} onClick={puzzles}><SlPuzzle/> Puzzles</button>
    </div>
}

export default MiniNav