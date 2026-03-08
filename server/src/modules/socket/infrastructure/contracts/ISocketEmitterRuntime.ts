import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

export interface ISocketEmitterRuntime extends ISocketEmitter {
    setServer(server: unknown): void;
    registerConnection(connection: unknown): void;
    unregisterConnection(connectionId: string): void;
}
