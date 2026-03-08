import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';

export interface ISocketRoomManagerRuntime extends ISocketRoomManager {
    setServer(server: unknown): void;
    registerConnection(connection: unknown): void;
    unregisterConnection(connectionId: string): void;
}
