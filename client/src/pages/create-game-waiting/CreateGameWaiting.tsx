import {ReactElement, useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {FaRegCopy} from "react-icons/fa";
import {socketEmit, socketEmitWithAck, SocketMessage, socketOff, socketOn} from "../../webSocket/webSocketManager";
import {getRoomTopicName} from "../game/utils";
import './CreateGameWaiting.css'
import '../Main.css'

function CreateGameWaiting(): ReactElement {
    const {search} = useLocation()
    const params = new URLSearchParams(search)
    const roomId = params.get("roomId") || undefined
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
        function onPlayerJoinListener(message: SocketMessage<{ gameId: string }>
        ) {
            console.log("player joined")
            navigate(`/game?gameId=${message.data.gameId}`)
        }

        socketEmitWithAck("subscribe", getRoomTopicName(roomId))
            .then(() => {
                console.log("ack")
                setLink(window.location.origin + `/joinRoom?roomId=${roomId}`)
            })

        socketOn("player-joined", onPlayerJoinListener)
        return () => {
            socketOff(onPlayerJoinListener)
            socketEmit("unsubscribe", getRoomTopicName(roomId))
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