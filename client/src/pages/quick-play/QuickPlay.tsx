import {ReactElement} from "react";
import './QuickPlay.css'

type GridElementProps = {
    time: number,
    increment: number
}

function GridElement(props: GridElementProps): ReactElement {
    return <div className={"quickPlayGridElement"}>
        <div>{props.time} + {props.increment}</div>
    </div>
}

export default function (): ReactElement {
    return <div className={"center"}>
        <div style={{width: "33%"}}>
            <div className={"quickPlayContainer"}>
                <GridElement time={1} increment={0}/>
                <GridElement time={2} increment={1}/>
                <GridElement time={3} increment={0}/>
                <GridElement time={3} increment={2}/>
                <GridElement time={5} increment={0}/>
                <GridElement time={5} increment={3}/>
                <GridElement time={10} increment={0}/>
                <GridElement time={10} increment={5}/>
                <GridElement time={15} increment={10}/>
                <GridElement time={30} increment={0}/>
                <GridElement time={30} increment={20}/>
                <GridElement time={60} increment={0}/>
            </div>
        </div>
    </div>
}