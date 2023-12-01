// import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import Game from "./pages/game/Game";
import App from "./pages/app/App";
import {configure} from "./config";
import CreateGameWaiting from "./pages/create-game-waiting/CreateGameWaiting";
import JoinRoom from "./pages/join-room/JoinRoom";
import QuickPlayWait from "./pages/quick-play-wait/QuickPlayWait";
// import React from "react";
import Puzzles from "./pages/puzzles/Puzzles";
import CreateRoomForm from "./pages/create-room-form/CreateRoomForm";

configure()


const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <BrowserRouter>
        <Routes>
            <Route path={"/"} element={<App/>}/>
            <Route path={"/room"} element={<Game/>}/>
            <Route path={"/waitingRoom"} element={<CreateGameWaiting/>}/>
            <Route path={"/joinRoom"} element={<JoinRoom/>}/>
            <Route path={"/quickPlay"} element={<QuickPlayWait/>}/>
            <Route path={"/puzzle"} element={<Puzzles/>}/>
            <Route path={"/createRoom"} element={<CreateRoomForm/>}/>
        </Routes>
    </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// import Game from "./pages/game/Game";
reportWebVitals();
