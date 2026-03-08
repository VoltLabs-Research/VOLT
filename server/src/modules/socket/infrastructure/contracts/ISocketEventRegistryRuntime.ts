import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';

export interface ISocketEventRegistryRuntime extends ISocketEventRegistry {
    registerConnection(connection: unknown): void;
    unregisterConnection(connectionId: string): void;
}
