import { ISocketConnection } from './ISocketModule';

export interface PresenceUser {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isAnonymous: boolean;
    [key: string]: unknown;
}

export interface ISocketRoomManager {
    join(
        socketId: string, 
        room: string
    ): Promise<void>;

    leave(
        socketId: string, 
        room: string
    ): Promise<void>;

    /**
     * Get all socket IDs currently in a room.
     * Works across cluster nodes when using Redis adapter.
     * @param room - Room identifier
     */
    getSocketsInRoom(
        room: string
    ): Promise<string[]>;

    getRoomsOfSocket(
        socketId: string
    ): string[];

    isInRoom(
        socketId: string, 
        room: string
    ): boolean;

    /**
     * Get presence information for all users in a room.
     * Deduplicates by user ID.
     * @param room - Room identifier
     * @param userExtractor - Optional function to extract user data from connection
     */
    collectPresence(
        room: string,
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): Promise<PresenceUser[]>;
}
