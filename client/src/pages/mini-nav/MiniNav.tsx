import {ReactElement} from "react";
import '../Main.css'
import './MiniNav.css'

const MiniNav = (): ReactElement => {


    return <div>
        <a href={"/room"}>
            <button id={"quickPairButton"} className={"center"}>Quick pairing</button>
        </a>
        <button id={"lobbyButton"} className={"center"}>Create game</button>
    </div>
}

export default MiniNav