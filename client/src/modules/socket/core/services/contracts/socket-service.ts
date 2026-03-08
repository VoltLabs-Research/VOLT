export interface SocketOptions {
    url?: string;
    path?: string;
    auth?: Record<string, unknown>;
    autoConnect?: boolean;
    timeout?: number;
}

export interface EventSubscription {
    event: string;
    callback: (...args: unknown[]) => void;
}

export interface ISocketService {
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    on<TArgs extends unknown[]>(event: string, callback: (...args: TArgs) => void): () => void;
    off<TArgs extends unknown[]>(event: string, callback?: (...args: TArgs) => void): void;
    emit<T = unknown>(event: string, data?: unknown): Promise<T>;
    updateAuth(auth: Record<string, unknown>): void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
}
