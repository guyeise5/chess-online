import {ReactElement, useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import axios, {AxiosError} from "axios";
import {redirectToGameIntervalMillis} from "../../config";


function JoinRoom(): ReactElement {
    const {search} = useLocation()
    const params = new URLSearchParams(search)
    const roomId = params.get("roomId")
    const navigate = useNavigate()

    async function redirectingToGame() {
        try {
            console.log("trying to join room...")
            const resp = await axios.post(`/api/v2/room/${roomId}/join`)
            console.log("join room data", resp.data)
            const gameId: string = resp.data.gameId
            navigate(`/game?gameId=${gameId}`)
        } catch (e: unknown | AxiosError) {
            console.log(e)
            if (axios.isAxiosError(e) && ((e.response?.status || 0) / 100 !== 4)) {
                console.log("response body", e?.response?.data)
                alert("unable to join room")
                navigate("/")
                return
            }

            setTimeout(redirectingToGame, redirectToGameIntervalMillis)
        }
    }

    useEffect(() => {
        redirectingToGame().finally()
    }, []);

    return <div>
        Joining room, please wait...
    </div>
}

export default JoinRoom