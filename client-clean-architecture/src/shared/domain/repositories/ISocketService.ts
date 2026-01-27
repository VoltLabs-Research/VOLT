export interface ISocketService {
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    on<T = any>(event: string, callback: (data: T) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    emit<T = any>(event: string, data?: any): Promise<T>;
    subscribeToTeam(teamId: string, previousTeamId?: string): void;
}
