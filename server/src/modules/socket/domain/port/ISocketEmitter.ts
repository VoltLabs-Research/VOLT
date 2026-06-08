export interface ISocketEmitter {
    emitToRoom(
        room: string, 
        event: string, 
        data: unknown
    ): void;

    emitToSocket(
        socketId: string, 
        event: string, 
        data: unknown
    ): void;

    emitToRoomExcept(
        socketId: string, 
        room: string, 
        event: string, 
        data: unknown
    ): void;

    broadcast(
        event: string,
        data: unknown
    ): void;
}
