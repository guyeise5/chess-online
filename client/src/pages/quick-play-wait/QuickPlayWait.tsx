import {ReactElement, useEffect} from "react";
import {AiOutlineLoading3Quarters} from "react-icons/ai";
import '../../css/LoadingIcon.css'
import axios from "axios";
import {useNavigate} from "react-router-dom";
import {socket} from "../../webSocket/webSocketManager";
import {getTopicName} from "../game/utils";
import {Color} from "chess.js";

function QuickPlayWait(): ReactElement {
    const navigate = useNavigate()

    useEffect(() => {
        let onPlayerJoined: (() => void) | undefined = undefined
        const response = axios.post<{color: Color, roomId: string}>("/api/v1/room/create")
            .then(resp => {
                const data: {
                    color: string,
                    roomId: string,
                } = resp.data

                onPlayerJoined = function onPlayerJoined() {
                    navigate(`/room?roomId=${data.roomId}&color=${data.color}`)
                }
                socket().emit("subscribe", getTopicName(data.roomId))
                socket().on("playerJoined", onPlayerJoined)

                return data
            })
            .catch(e => {
                console.log(e)
                alert("unable to join room")
            })

        return () => {
            response.then(data => {
                if (data) {
                    if (onPlayerJoined) {
                        socket().off("playerJoined", onPlayerJoined)
                    }
                }
            })
        }
    }, [])
    return <div>
        <h1>
            <AiOutlineLoading3Quarters className="loaderIcon"/>
            Waiting for opponent to join
        </h1>
    </div>
}


export default QuickPlayWait