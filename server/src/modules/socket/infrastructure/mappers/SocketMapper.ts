import { Socket } from 'socket.io';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { injectable } from 'tsyringe';
import { ISocketMapper } from '@modules/socket/domain/ports/ISocketMapper';

@injectable()
export default class SocketMapper implements ISocketMapper {
    /**
     * Convert a Socket.IO socket to ISocketConnection.
     */
    toDomain(socket: Socket): ISocketConnection {
        const user = (socket as any).user;
        return {
            id: socket.id,
            userId: user?._id?.toString(),
            user: user ? {
                _id: user._id?.toString(),
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar,
                teams: user.teams?.map((t: any) => t.toString())
            } : undefined,
            data: socket.data || {},
            rooms: socket.rooms,
            nativeSocket: socket
        };
    }
};