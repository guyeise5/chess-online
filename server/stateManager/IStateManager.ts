import {Chess} from 'chess.js'

export type ChessRoom = {
    chess: Chess,
    whitePlayerId?: string
    blackPlayerId?: string
}
export type IStateManager = {
    getRoom(roomId: string): ChessRoom
}