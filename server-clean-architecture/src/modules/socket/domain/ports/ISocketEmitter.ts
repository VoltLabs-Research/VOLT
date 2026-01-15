/**
 * Port interface for emitting events through sockets.
 */
export interface ISocketEmitter {
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
     * Emit an event to all sockets in a specific room.
     * @param room - Room identifier
     * @param event - Event name
     * @param data - Data payload to send
     */
    emitToRoom(
        room: string, 
        event: string, 
        data: unknown
    ): void;

    /**
     * Emit an event to a specific socket by ID.
     * @param socketId - Target socket identifier
     * @param event - Event name
     * @param data - Data payload to send
     */
    emitToSocket(
        socketId: string, 
        event: string, 
        data: unknown
    ): void;

    /**
     * Emit an event to all sockets in a room except the sender.
     * @param socketId - Sender socket identifier (to exclude)
     * @param room - Room identifier
     * @param event - Event name
     * @param data - Data payload to send
     */
    emitToRoomExcept(
        socketId: string, 
        room: string, 
        event: string, 
        data: unknown
    ): void;

    /**
     * Broadcast an event to all connected sockets.
     * @param event - Event name
     * @param data - Data payload to send
     */
    broadcast(
        event: string, 
        data: unknown
    ): void;
};
