import {ReactElement} from "react";
import '../Main.css'
import './App.css'
import MiniNav from "../mini-nav/MiniNav";
import RoomTable from "../room-table/RoomTable";

const App = (): ReactElement => {
    return <div>
        <MiniNav/>
        <RoomTable/>
    </div>
}

export default App