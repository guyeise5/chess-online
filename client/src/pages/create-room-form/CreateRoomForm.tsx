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
    hidden: boolean
}
export default function (): ReactElement {
    const [minutesPerSide, setMinutesPerSide] = useState<number>(Number(localStorage.getItem("minutesPerSide")) || 5)
    const [incrementPerSide, setIncrementPerSide] = useState<number>(Number(localStorage.getItem("incrementPerSide")) || 3)
    const navigate = useNavigate()
    const [params, _setParams] = useSearchParams()
    const hidden: boolean = params.get("hidden") === "true"

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
            selectedColor: color,
            incrementPerSide: incrementPerSide,
            minutesPerSide: minutesPerSide,
            hidden: hidden
        };

        axios.post("/api/v1/room/create", data)
            .then(resp => {
                const data: { color: Color, roomId: string } = resp.data
                console.log("data", data)
                navigate(`/waitingRoom?roomId=${data.roomId}&color=${data.color}`)
            })

    }

    return <div>
        <div className={"center"}>
            <div>
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