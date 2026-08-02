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
    currentChatId?: string;
    currentChatTeamId?: string;
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

export type { PresenceUser } from '@volt/contracts/modules/socket/domain';

export type SocketEventHandler<T = unknown, TResult = unknown> = (
    connection: ISocketConnection,
    payload: T
) => TResult | Promise<TResult>;

export interface ISocketModule {
    readonly name: string;

    onInit(): void | Promise<void>;

    onConnection(connection: ISocketConnection): void;

    onShutdown(): Promise<void>;
}
