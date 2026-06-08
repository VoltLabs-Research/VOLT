import { ISocketConnection } from './ISocketModule';

export type SocketEventHandler<T = unknown, TResult = unknown> = (
    connection: ISocketConnection,
    payload: T
) => TResult | Promise<TResult>;

export interface ISocketEventRegistry {
    on<T = unknown, TResult = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T, TResult>
    ): void;

    off(
        socketId: string, 
        event: string
    ): void;

    onDisconnect(
        socketId: string,
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void;
}
