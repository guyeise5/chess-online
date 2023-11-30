import {Color} from "chess.js";

type Base = {
    type: string
    details?: string
}

type Winner = Base & {
    winner: Color
}

export type Draw = Base & {
    type: "DRAW"
}
export type CheckMate = Winner & {
    type: "CHECKMATE"
}
export type Flag = Winner & {
    type: "FLAG"
}
export type Disconnected = Winner & {
    type: "DISCONNECTED"
}
export type GameOverReason = Draw | CheckMate | Flag | Disconnected