import {ChessRoom, ClientStatus, CreateRoomOptions, IStateManager} from "./IStateManager";
import {Chess} from 'chess.js'
import {v4} from "uuid";

class LocalStateManager implements IStateManager {
    private quickPlayRoom: ChessRoom | undefined
    private readonly rooms: Record<string, ChessRoom> = {}
    private readonly clientHeartbeatCache: Record<string, Date> = {}

    public getRoom(roomId: string): ChessRoom | undefined {
        return this.rooms[roomId]
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

    createRoom(options: CreateRoomOptions): ChessRoom {
        const roomId = Buffer.from(v4()).toString('base64').substring(0,15)
        const room: ChessRoom = {
            id: roomId,
            chess: new Chess(),
            hidden: !!options?.hidden,
            whitePlayerSeconds: options?.whitePlayerSeconds,
            blackPlayerSeconds: options?.blackPlayerSeconds,
            whitePlayerIncSeconds: options?.whitePlayerIncSeconds || 0,
            blackPlayerIncSeconds: options?.blackPlayerIncSeconds || 0
        };

        this.rooms[roomId] = room
        return room
    }

    getRooms(): ChessRoom[] {
        return Object.values(this.rooms)
            .filter(chessRoom => !chessRoom.blackPlayerId || !chessRoom.whitePlayerId)
    }
}

export const instance = new LocalStateManager()