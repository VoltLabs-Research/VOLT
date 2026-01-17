import { Socket } from 'socket.io';

export interface ITerminalService {
    attach(socket: Socket, containerId: string): Promise<void>;
    detach(socket: Socket, containerId: string): void;
    handleConnection(socket: Socket): void;
}
