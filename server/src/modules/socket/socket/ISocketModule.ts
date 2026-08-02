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

export interface ISocketAuthenticationResult {
    readonly state: 'guest' | 'authenticated' | 'rejected';
    readonly reason?: 'missing_token' | 'invalid_token' | 'user_not_found' | 'password_changed';
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
