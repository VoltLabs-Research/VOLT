import { ISocketConnection } from './ISocketModule';

/**
 * Represents presence information for a user in a room.
 */
export interface PresenceUser {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isAnonymous: boolean;
    [key: string]: unknown;
};

/**
 * Port interface for managing socket rooms.
 */
export interface ISocketRoomManager {
    setServer(
        socket: any
    ): void;

    registerSocket(
        socket: any
    ): void;

    unregisterSocket(
        socketId: string
    ): void;

    /**
     * Add a socket to a room.
     * @param socketId - Socket identifier
     * @param room - Room identifier
     */
    join(
        socketId: string, 
        room: string
    ): Promise<void>;

    /**
     * Remove a socket from a room.
     * @param socketId - Socket identifier
     * @param room - Room identifier
     */
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

    /**
     * Get all rooms a socket has joined.
     * @param socketId - Socket identifier
     */
    getRoomsOfSocket(
        socketId: string
    ): string[];

    /**
     * Check if a socket is in a specific room.
     * @param socketId - Socket identifier
     * @param room - Room identifier
     */
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
