import {Chess} from 'chess.js'

export type ChessRoom = {
    chess: Chess,
    whitePlayerId?: string
    blackPlayerId?: string,
    id: string
}

export type ClientStatus = {
    userId: string,
    lastHeartbeat: Date
}
export type IStateManager = {
    getOrCreateRoom(roomId: string): ChessRoom
    getOrCreateQuickRoom(): ChessRoom
    deleteRoom(roomId: string): void
    isRoomExists(roomId: string): boolean
    // return the last heart beat of each player
    // if never, it should return now and record the time
    getClientsStatus(clientId: string, ...otherClientsIds: string[]): ClientStatus[]
    recordClientHeartbeat(clientId: string): void
}