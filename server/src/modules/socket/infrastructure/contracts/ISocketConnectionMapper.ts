import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';

export interface ISocketConnectionMapper {
    toDomain(connection: unknown): ISocketConnection;
}
