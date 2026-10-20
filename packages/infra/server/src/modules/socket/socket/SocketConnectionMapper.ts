import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import type { Socket } from 'socket.io';

export const toSocketConnection = (socket: Socket): ISocketConnection => {
    const data = socket.data as ISocketConnection['data'];
    const user = (socket as Socket & { user?: ISocketConnection['user'] | null }).user
        ?? data?.auth?.user;

    return {
        id: socket.id,
        userId: user?._id,
        user,
        data: data ?? {},
        nativeSocket: socket
    };
};
