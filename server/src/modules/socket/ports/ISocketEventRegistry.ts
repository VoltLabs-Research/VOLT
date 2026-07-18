import { ISocketConnection } from '@modules/socket/ports/ISocketModule';

export type SocketEventHandler<T = unknown, TResult = unknown> = (
    connection: ISocketConnection,
    payload: T
) => TResult | Promise<TResult>;
