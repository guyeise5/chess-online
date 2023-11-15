import {ChessRoom} from "../stateManager/IStateManager";
import {Square, SQUARES} from "chess.js";

export const isGameAvailable = (room: ChessRoom | undefined): boolean => {
    if(!room) {
        return false;
    }

    if(!room.blackPlayerId || !room.whitePlayerId) {
        return false;
    }

    return !room.chess.isGameOver()
}

export const toSquare = (s: string | undefined): Square | undefined => {
    return SQUARES.find(square => square === s)
}