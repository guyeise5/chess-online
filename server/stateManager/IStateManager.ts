import {Chess} from 'chess.js'

export type ChessRoom = {
    chess: Chess,
    whitePlayerId?: string
    blackPlayerId?: string,
    id: string,
    hidden?: boolean
}

export type CreateRoomOptions = {
    hidden: boolean
}

export type ClientStatus = {
    userId: string,
    lastHeartbeat: Date
}
export type IStateManager = {
    getRoom(roomId: string): ChessRoom | undefined
    getOrCreateQuickRoom(): ChessRoom
    createRoom(option?: CreateRoomOptions): ChessRoom
    deleteRoom(roomId: string): void
    isRoomExists(roomId: string): boolean
    // return the last heart beat of each player
    // if never, it should return now and record the time
    getClientsStatus(clientId: string, ...otherClientsIds: string[]): ClientStatus[]
    recordClientHeartbeat(clientId: string): void
    getRooms(): ChessRoom[]
}