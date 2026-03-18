import type { ContainerTerminalError, ContainerTerminalResizePayload, ITerminalClient } from '@modules/container/domain/port/ITerminalService';
import { createSocketErrorEnvelope } from '@modules/socket/utilities/socket-error-envelope';
import type { Socket } from 'socket.io';

export class SocketTerminalClient implements ITerminalClient {
    constructor(private readonly socket: Socket) {}

    get id(): string {
        return this.socket.id;
    }

    joinRoom(room: string): void {
        this.socket.join(room);
    }

    leaveRoom(room: string): void {
        this.socket.leave(room);
    }

    emitData(data: string): void {
        this.socket.emit('container:terminal:data', data);
    }

    emitDataToRoom(room: string, data: string): void {
        this.socket.nsp.to(room).emit('container:terminal:data', data);
    }

    emitError(error: ContainerTerminalError): void {
        this.socket.emit('container:error', createSocketErrorEnvelope(error.code, error.details));
    }

    emitErrorToRoom(room: string, error: ContainerTerminalError): void {
        this.socket.nsp.to(room).emit('container:error', createSocketErrorEnvelope(error.code, error.details));
    }

    onInput(listener: (input: string) => void): void {
        this.socket.on('container:terminal:input', listener);
    }

    offInput(listener: (input: string) => void): void {
        this.socket.off('container:terminal:input', listener);
    }

    onResize(listener: (size: ContainerTerminalResizePayload) => void): void {
        this.socket.on('container:terminal:resize', listener);
    }

    offResize(listener: (size: ContainerTerminalResizePayload) => void): void {
        this.socket.off('container:terminal:resize', listener);
    }

    onDetach(listener: () => void): void {
        this.socket.on('container:terminal:detach', listener);
    }

    offDetach(listener: () => void): void {
        this.socket.off('container:terminal:detach', listener);
    }

    onDisconnect(listener: () => void): void {
        this.socket.on('disconnect', listener);
    }

    offDisconnect(listener: () => void): void {
        this.socket.off('disconnect', listener);
    }
};
