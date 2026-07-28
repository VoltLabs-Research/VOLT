import type { ISocketConnection, SocketEventHandler } from '@modules/socket/socket/ISocketModule';
import socketConnectionMapper from '@modules/socket/socket/SocketConnectionMapper';
import { Socket } from 'socket.io';

export default class SocketIOEventRegistry {
    private sockets: Map<string, Socket> = new Map();
    private disconnectHandlers: Map<string, Array<(connection: ISocketConnection) => void | Promise<void>>> = new Map();

    registerConnection(socket: unknown): void{
        this.registerSocket(socket as Socket);
    }

    unregisterConnection(socketId: string): void{
        this.unregisterSocket(socketId);
    }

    private registerSocket(socket: Socket): void{
        this.sockets.set(socket.id, socket);
    }

    private unregisterSocket(socketId: string): void{
        this.sockets.delete(socketId);
        this.disconnectHandlers.delete(socketId);
    }

    on<T = unknown, TResult = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T, TResult>
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        socket.on(event, async (payload: T, ack?: (...args: unknown[]) => void) => {
            try {
                const connection = socketConnectionMapper.toDomain(socket);
                const result = await handler(connection, payload);
                if(typeof ack === 'function'){
                    ack(result === undefined ? { ok: true } : result);
                }
            } catch(error) {
                if(typeof ack === 'function'){
                    ack({
                        ok: false,
                        error: error instanceof Error ? error.message : 'Internal error'
                    });
                }
            }
        });
    }

    onDisconnect(
        socketId: string,
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        let handlers = this.disconnectHandlers.get(socketId);
        if(!handlers){
            handlers = [];
            this.disconnectHandlers.set(socketId, handlers);

            socket.on('disconnect', async () => {
                const connection = socketConnectionMapper.toDomain(socket);
                const fns = this.disconnectHandlers.get(socketId);
                if (!fns) {
                    return;
                }
                await Promise.all(fns.map((fn) => fn(connection)));
            });
        }

        handlers.push(handler);
    }
}

export const socketIOEventRegistry = new SocketIOEventRegistry();
