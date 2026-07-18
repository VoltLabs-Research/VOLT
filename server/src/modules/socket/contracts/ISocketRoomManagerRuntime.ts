import type { ISocketRoomManager } from '@modules/socket/ports/ISocketRoomManager';

export interface ISocketRoomManagerRuntime extends ISocketRoomManager {
    setServer(server: unknown): void;
    registerConnection(connection: unknown): void;
    unregisterConnection(connectionId: string): void;
}
