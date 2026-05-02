import type { Socket } from 'socket.io';

export interface ISocketConnectionUser {
    readonly _id: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly email?: string;
    readonly avatar?: string;
    readonly teams?: string[];
    readonly role?: string;
}

export type SocketAuthenticationState = 'guest' | 'authenticated' | 'rejected';

export type SocketAuthenticationReason =
    | 'missing_token'
    | 'invalid_token'
    | 'user_not_found'
    | 'password_changed';

export interface ISocketAuthenticationResult {
    readonly state: SocketAuthenticationState;
    readonly reason?: SocketAuthenticationReason;
    readonly user?: ISocketConnectionUser;
}

export interface ISocketConnectionData {
    currentTeamId?: string;
    auth?: ISocketAuthenticationResult;
    [key: string]: unknown;
}

export interface ISocketConnection {
    readonly id: string;
    readonly userId?: string;
    readonly user?: ISocketConnectionUser;
    data: ISocketConnectionData;
    readonly rooms: Set<string>;
    nativeSocket?: Socket;
}

/**
 * Base interface that all socket modules must implement.
 */
export interface ISocketModule {
    /** Unique name identifier for this module */
    readonly name: string;

    /**
     * Called once when the module is registered with the gateway.
     * Use for initialization that doesn't depend on individual connections.
     */
    onInit(): void | Promise<void>;

    /**
     * Called for each new socket connection.
     * @param connection - Abstracted socket connection
     */
    onConnection(connection: ISocketConnection): void;

    /**
     * Called during graceful shutdown.
     * Use for cleanup of resources, intervals, subscriptions, etc.
     */
    onShutdown(): Promise<void>;
}
