import type { ContainerTerminalError, ContainerTerminalResizePayload, ITerminalClient } from '@modules/container/domain/port/ITerminalService';
import { createSocketErrorEnvelope } from '@modules/socket/utilities/socket-error-envelope';
import type { Socket } from 'socket.io';

export class SocketTeamClusterTerminalClient implements ITerminalClient {
    constructor(private readonly socket: Socket) {}

    joinRoom(room: string): void {
        this.socket.join(room);
    }

    leaveRoom(room: string): void {
        this.socket.leave(room);
    }

    emitData(data: string): void {
        this.socket.emit('team-cluster:terminal:data', data);
    }

    emitDataToRoom(room: string, data: string): void {
        this.socket.nsp.to(room).emit('team-cluster:terminal:data', data);
    }

    emitError(error: ContainerTerminalError): void {
        this.socket.emit('team-cluster:terminal:error', createSocketErrorEnvelope(error.code, error.details));
    }

    emitErrorToRoom(room: string, error: ContainerTerminalError): void {
        this.socket.nsp.to(room).emit('team-cluster:terminal:error', createSocketErrorEnvelope(error.code, error.details));
    }

    onInput(listener: (input: string) => void): void {
        this.socket.on('team-cluster:terminal:input', listener);
    }

    offInput(listener: (input: string) => void): void {
        this.socket.off('team-cluster:terminal:input', listener);
    }

    onResize(listener: (size: ContainerTerminalResizePayload) => void): void {
        this.socket.on('team-cluster:terminal:resize', listener);
    }

    offResize(listener: (size: ContainerTerminalResizePayload) => void): void {
        this.socket.off('team-cluster:terminal:resize', listener);
    }

    onDetach(listener: () => void): void {
        this.socket.on('team-cluster:terminal:detach', listener);
    }

    offDetach(listener: () => void): void {
        this.socket.off('team-cluster:terminal:detach', listener);
    }

    onDisconnect(listener: () => void): void {
        this.socket.on('disconnect', listener);
    }

    offDisconnect(listener: () => void): void {
        this.socket.off('disconnect', listener);
    }
}
