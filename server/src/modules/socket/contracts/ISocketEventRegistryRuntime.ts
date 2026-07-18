import type { ISocketEventRegistry } from '@modules/socket/ports/ISocketEventRegistry';

export interface ISocketEventRegistryRuntime extends ISocketEventRegistry {
    registerConnection(connection: unknown): void;
    unregisterConnection(connectionId: string): void;
}
