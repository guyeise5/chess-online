import {ChessRoom, ClientStatus, IStateManager} from "./IStateManager";
import {Chess} from 'chess.js'
import {v4} from "uuid";

class LocalStateManager implements IStateManager {
    private quickPlayRoom: ChessRoom | undefined
    private readonly rooms: Record<string, ChessRoom> = {}
    private readonly clientHeartbeatCache: Record<string, Date> = {}

    public getRoom(roomId: string): ChessRoom | undefined {
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

    getClientsStatus(clientId: string | undefined, ...otherClientsIds: (string | undefined)[]): ClientStatus[] {
        const clientIds = [clientId, ...otherClientsIds].flatMap(x => x ? [x] : [])
        return clientIds.map(id => this.getClientStatus(id));
    }

    private getClientStatus(userId: string): ClientStatus {
        const lastHeartbeat = this.clientHeartbeatCache[userId]
        if (!lastHeartbeat) {
            this.recordClientHeartbeat(userId)
        }

        return {
            userId: userId,
            lastHeartbeat: this.clientHeartbeatCache[userId]
        }
    }

    recordClientHeartbeat(clientId: string): void {
        this.clientHeartbeatCache[clientId] = new Date()
    }

    deleteRoom(roomId: string): void {
        delete this.rooms[roomId]
        if (this.quickPlayRoom?.id === roomId) {
            this.quickPlayRoom = undefined
        }
    }

    isRoomExists(roomId: string): boolean {
        return this.quickPlayRoom?.id === roomId || !!this.rooms[roomId]
    }

    createRoom(): ChessRoom {
        const roomId = v4()
        const room = {
            id: roomId,
            chess: new Chess()
        };

        this.rooms[roomId] = room
        return room
    }
}

export const instance = new LocalStateManager()