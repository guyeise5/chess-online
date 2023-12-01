import {ChessRoom, ClientStatus, CreateRoomOptions, IStateManager} from "./IStateManager";
import {BLACK, Chess, WHITE} from 'chess.js'
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
        const room: ChessRoom | undefined = this.rooms[roomId];
        room?.cancelClockTickInterval && room.cancelClockTickInterval()
        delete this.rooms[roomId]
    }

    isRoomExists(roomId: string): boolean {
        return this.quickPlayRoom?.id === roomId || !!this.rooms[roomId]
    }

    createRoom(options: CreateRoomOptions): ChessRoom {
        const roomId = Buffer.from(v4()).toString('base64').substring(0,15)
        const selectedKey: keyof ChessRoom = options.selectedColor == WHITE ? 'whitePlayerId' : options.selectedColor == BLACK ? 'blackPlayerId' : Math.random() > 0.5 ? 'whitePlayerId' : 'blackPlayerId'
        const room: ChessRoom = {
            name: options.name,
            id: roomId,
            chess: new Chess(),
            hidden: !!options?.hidden,
            whitePlayerSeconds: (options?.minutesPerSide) && (options?.minutesPerSide * 60),
            blackPlayerSeconds: (options?.minutesPerSide) && (options?.minutesPerSide * 60),
            incSeconds: options?.incrementPerSide || 0,
            [selectedKey]: options.userId,
            randomChoice: options.selectedColor == "random"
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