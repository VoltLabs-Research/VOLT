export interface SocketOptions{
    url?: string;
    path?: string;
    auth?: Record<string, unknown>;
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    timeout?: number;
};

export interface EventSubscription{
    event: string;
    callback: (...args: unknown[]) => void;
};

export default interface ISocketService{
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    on(event: string, callback: (...args: unknown[]) => void): () => void;
    off(event: string, callback?: (...args: unknown[]) => void): void;
    emit<T = unknown>(event: string, data?: unknown): Promise<T>;
    updateAuth(auth: Record<string, unknown>): void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    subscribeToTeam(teamId: string, previousTeamId?: string): void;
    unsubscribeFromTeam(teamId?: string): void;
};
