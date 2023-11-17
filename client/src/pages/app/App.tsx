import {ReactElement} from "react";
import '../Main.css'
import './App.css'
import MiniNav from "../mini-nav/MiniNav";
import Game from "../game/Game";

const App = (): ReactElement => {
    const path = window.location.pathname
    return <div>
        <MiniNav/>
        {path == "/room" && <Game roomId={"2"}></Game>}
    </div>
}

export default App