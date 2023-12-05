import Slider from '@mui/material/Slider';
import {ReactElement, useEffect, useState} from "react";
import '../Main.css'
import './CreateRoomForm.css'
import {ReactComponent as WhiteKing} from '../../img/wK.svg'
import {ReactComponent as BlackKing} from '../../img/bK.svg'
import {ReactComponent as WhiteBlackKing} from '../../img/wbK.svg'
import {BLACK, Color, WHITE} from "chess.js";
import axios from "axios";
import {useNavigate, useSearchParams} from "react-router-dom";


export type CreateRoomData = {
    selectedColor: Color | "random"
    minutesPerSide: number
    incrementPerSide: number
    hidden: boolean,
    name: string
}
export default function (): ReactElement {
    const [minutesPerSide, setMinutesPerSide] = useState<number>(Number(localStorage.getItem("minutesPerSide")) || 5)
    const [incrementPerSide, setIncrementPerSide] = useState<number>(Number(localStorage.getItem("incrementPerSide")) || 3)
    const navigate = useNavigate()
    const [params, _setParams] = useSearchParams()
    const [name, setName] = useState<string>(localStorage.getItem("default-room-name") || "")
    const hidden: boolean = params.get("hidden") === "true"

    useEffect(() => {
        localStorage.setItem("default-room-name", name)
    }, [name]);

    useEffect(() => {
        localStorage.setItem("minutesPerSide", String(minutesPerSide))
    }, [minutesPerSide]);

    useEffect(() => {
        localStorage.setItem("incrementPerSide", String(incrementPerSide))
    }, [incrementPerSide]);

    useEffect(() => {
        if (!localStorage.getItem("minutesPerSide")) {
            localStorage.setItem("minutesPerSide", "5")
        }
        if (!localStorage.getItem("incrementPerSide")) {
            localStorage.setItem("incrementPerSide", "3")
        }

    }, []);

    const handleMinutesChanged = (_event: Event, newValue: number | number[]) => {
        setMinutesPerSide(newValue as number);
    };

    const handleIncrementChanged = (_event: Event, newValue: number | number[]) => {
        setIncrementPerSide(newValue as number);
    };

    function onButtonClick(color: Color | "random"): void {
        const data: CreateRoomData = {
            name: name,
            selectedColor: color,
            incrementPerSide: incrementPerSide,
            minutesPerSide: minutesPerSide,
            hidden: hidden
        };

        axios.post("/api/v2/room/create", data)
            .then(resp => {
                const data: { roomId: string } = resp.data
                console.log("data", data)
                navigate(`/waitingRoom?roomId=${data.roomId}`)
            })

    }

    function roomNameElement(): ReactElement {
        if (hidden) {
            return <div></div>
        }

        return <div>
            <label>Room Name</label>
            <br/>
            <input value={name} onChange={e => setName(e.target.value)}/>
            <br/>
        </div>
    }

    return <div>
        <div className={"center"}>
            <div>
                {roomNameElement()}
                <label>Minutes per side: {minutesPerSide}</label>
                <Slider aria-label="Minutes per side" min={1} max={180} value={minutesPerSide}
                        onChange={handleMinutesChanged}/>

                <label>Increment in seconds: {incrementPerSide}</label>
                <Slider aria-label="Increment in seconds" min={0} max={180} value={incrementPerSide}
                        onChange={handleIncrementChanged}/>
                <div>
                    <button className={"createGameButton blackKingCreateGame"} onClick={() => onButtonClick(BLACK)}>
                        <BlackKing/></button>
                    <button className={"createGameButton whiteBlackKingCreateGame"}
                            onClick={() => onButtonClick("random")}>
                        <WhiteBlackKing/></button>
                    <button className={"createGameButton whiteKingCreateGame"} onClick={() => onButtonClick(WHITE)}>
                        <WhiteKing/></button>
                </div>
            </div>
        </div>
    </div>
}