import {ChessRoom, IStateManager} from "./IStateManager";
import {Chess} from 'chess.js'
import {v4} from "uuid";

class LocalStateManager implements IStateManager {
    private quickPlayRoom: ChessRoom| undefined
    private readonly rooms: Record<string, ChessRoom> = {}

    public getOrCreateRoom(roomId: string): ChessRoom {
        if (!this.rooms[roomId]) {
            this.rooms[roomId] = {
                chess: new Chess(),
                id: roomId
            }
        }
        return this.rooms[roomId]
    }

    getOrCreateQuickRoom(): ChessRoom {
        if (this.quickPlayRoom?.whitePlayerId && this.quickPlayRoom.blackPlayerId) {
            this.quickPlayRoom = undefined
        }

        if (!this.quickPlayRoom) {
            this.quickPlayRoom = {
                chess: new Chess(),
                id: v4()
            }

        }
        this.rooms[this.quickPlayRoom.id] = this.quickPlayRoom
        return this.quickPlayRoom
    }
}

export const instance = new LocalStateManager()