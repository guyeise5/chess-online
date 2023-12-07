import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import {configure} from "./config";
import CreateGameWaiting from "./pages/create-game-waiting/CreateGameWaiting";
import JoinRoom from "./pages/join-room/JoinRoom";
import Puzzles from "./pages/puzzles/Puzzles";
import CreateRoomForm from "./pages/create-room-form/CreateRoomForm";
import Analyze from "./pages/analyze/Analyze";
import MiniNav from "./pages/mini-nav/MiniNav";
import RoomTable from "./pages/room-table/RoomTable";
import QuickPlay from "./pages/quick-play/QuickPlay";
import GameWrapper from "./pages/game/GameWrapper";

configure()


const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <BrowserRouter>
        <MiniNav/>
        <Routes>
            <Route path={"/"} element={<RoomTable/>}/>
            <Route path={"/game"} element={<GameWrapper/>}/>
            <Route path={"/waitingRoom"} element={<CreateGameWaiting/>}/>
            <Route path={"/joinRoom"} element={<JoinRoom/>}/>
            <Route path={"/quickPlay"} element={<QuickPlay/>}/>
            <Route path={"/puzzle"} element={<Puzzles/>}/>
            <Route path={"/createRoom"} element={<CreateRoomForm/>}/>
            <Route path={"/analyze"} element={<Analyze/>}/>
            <Route path={"/lobby"} element={<RoomTable/>}/>
        </Routes>
    </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// import Game from "./pages/game/Game";
reportWebVitals();
