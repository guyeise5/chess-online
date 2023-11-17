import {Chess} from 'chess.js'

export type ChessRoom = {
    chess: Chess,
    whitePlayerId?: string
    blackPlayerId?: string,
    id: string
}
export type IStateManager = {
    getOrCreateRoom(roomId: string): ChessRoom
    getOrCreateQuickRoom(): ChessRoom
}