import { ISocketConnection } from './ISocketModule';

/**
 * Callback type for socket event handlers.
 */
export type SocketEventHandler<T = unknown, TResult = unknown> = (
    connection: ISocketConnection,
    payload: T
) => TResult | Promise<TResult>;

/**
 * Port interface for registering socket event listeners.
 */
export interface ISocketEventRegistry {
    /**
     * Register an event handler for a specific event.
     * @param socketId - Socket identifier
     * @param event - Event name to listen for
     * @param handler - Handler function to call when event is received
     */
    on<T = unknown, TResult = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T, TResult>
    ): void;

    /**
     * Remove an event handler.
     * @param socketId - Socket identifier
     * @param event - Event name
     */
    off(
        socketId: string, 
        event: string
    ): void;

    /**
     * Register a disconnect handler.
     * @param socketId - Socket identifier
     * @param handler - Handler function to call on disconnect
     */
    onDisconnect(
        socketId: string,
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void;
}
