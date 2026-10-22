import type { SocketConnectionStatus } from '@/modules/socket/utils/socket-connection-status';

export interface SocketOptions {
    auth?: Record<string, unknown>;
};

export interface EventSubscription {
    event: string;
    callback: (...args: unknown[]) => void;
};

export interface ISocketService {
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    getConnectionStatus(): SocketConnectionStatus;
    on<TArgs extends unknown[]>(event: string, callback: (...args: TArgs) => void): () => void;
    // Hands `event` to this client's listeners as though the server had sent it.
    deliver(event: string, ...args: unknown[]): void;
    emit<T = unknown>(event: string, data?: unknown): Promise<T>;
    emitWithoutAck(event: string, data?: unknown): void;
    updateAuth(auth: Record<string, unknown>): void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    onConnectionStatusChange(listener: (status: SocketConnectionStatus) => void): () => void;
};


export interface SocketAck<TData = unknown> {
    ok: boolean;
    data?: TData;
    error?: string;
};
