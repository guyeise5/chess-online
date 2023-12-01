import {ReactElement} from "react";
import {formatTime} from "./utils";
import './Clock.css'
type ClockProps = {
    seconds: number
}

export default function (props: ClockProps): ReactElement {
    const timeDisplay = formatTime(props.seconds)
    const divClass = props.seconds < 10 ? "clockLowTimeBackground" : "clockNormalTimeBackground"
    return <div className={`${divClass} clock`}>
        <label>{timeDisplay}</label>
    </div>
}