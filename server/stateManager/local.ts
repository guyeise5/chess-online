import {ChessRoom, IStateManager} from "./IStateManager";
import {Chess} from 'chess.js'

class LocalStateManager implements IStateManager {
    private readonly cache: Record<string, ChessRoom>

    constructor() {
        this.cache = {}
    }

    public getRoom(roomId: string): ChessRoom {
        if (!this.cache[roomId]) {
            this.cache[roomId] = {
                chess: new Chess()
            }
        }
        return this.cache[roomId]
    }
}

export const instance = new LocalStateManager()