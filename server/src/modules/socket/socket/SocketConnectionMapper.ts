import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import type { Socket } from 'socket.io';

class SocketConnectionMapper {
    toDomain(connection: unknown): ISocketConnection {
        const socket = connection as Socket & {
            user?: ISocketConnection['user'] | null;
        };
        const socketData = socket.data as ISocketConnection['data'] | undefined;
        const dataUser = socketData?.auth?.user;
        const user = socket.user ?? dataUser ?? undefined;
        const handshakeUserId = socket.handshake?.query?.userId;
        const connectionUserId = user?._id?.toString()
            ?? (Array.isArray(handshakeUserId)
                ? handshakeUserId[0]?.toString()
                : handshakeUserId?.toString());

        return {
            id: socket.id,
            userId: connectionUserId,
            user: user
                ? {
                    _id: user._id?.toString(),
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    avatar: user.avatar,
                    teams: user.teams?.map((teamId) => teamId.toString())
                }
                : undefined,
            data: socketData ?? {},
            rooms: socket.rooms ?? new Set<string>(),
            nativeSocket: socket
        };
    }
}

const socketConnectionMapper = new SocketConnectionMapper();

export default socketConnectionMapper;
