import {ReactElement, useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {FaRegCopy} from "react-icons/fa";
import {socket} from "../../webSocket/webSocketManager";
import {getTopicName, toColorFromString} from "../game/utils";
import './CreateGameWaiting.css'
import '../Main.css'

function CreateGameWaiting(): ReactElement {
    const {search} = useLocation()
    const params = new URLSearchParams(search)
    const roomId = params.get("roomId") || undefined
    const myColor = toColorFromString(params.get("color"))
    const [link, setLink] = useState<string>("")
    const navigate = useNavigate()

    function onLinkInputBoxClick() {
        const element = document.getElementById("linkInputBox")
        if (!(element instanceof HTMLInputElement)) {
            return
        }

        element.select()
        element.setSelectionRange(0, 999999)
    }

    useEffect(() => {
        function onPlayerJoinListener() {
            console.log("player joined")
            navigate(`/room?roomId=${roomId}&color=${myColor}`)
        }

        socket().emitWithAck("subscribe", getTopicName(roomId))
            .then(() => {
                console.log("ack")
                setLink(window.location.origin + `/joinRoom?roomId=${roomId}`)
            })

        socket().on("playerJoined", onPlayerJoinListener)
        return () => {
            socket().off("playerJoined", onPlayerJoinListener)
            socket().emit("unsubscribe", getTopicName(roomId))
        }
    }, []);

    function onCopyButtonClick() {
        navigator.clipboard.writeText(link).then(() => {
            // TODO: make it nicer to user
            console.log("copied to clipboard")
        })
    }

    return <div>
        <h1 className={"shareLinkTitle"}>Share this link</h1>
        <input id={"linkInputBox"} className={"linkInput"} type={"text"} disabled={true} onClick={onLinkInputBoxClick}
               value={link}/>
        <button className={"copyLinkButton"} onClick={onCopyButtonClick}><FaRegCopy/></button>
    </div>
}

export default CreateGameWaiting