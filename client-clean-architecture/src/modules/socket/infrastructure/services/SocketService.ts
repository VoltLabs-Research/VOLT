import { injectable, inject } from 'tsyringe';
import ISocketService from '../../domain/ports/ISocketService';
import { SOCKET_TOKENS } from '../di/tokens';

@injectable()
export default class SocketService implements ISocketService{
    constructor(
        @inject(SOCKET_TOKENS.SocketAdapter)
        private readonly adapter: ISocketService
    ){}

    connect(): Promise<void>{
        return this.adapter.connect();
    }

    disconnect(): void{
        this.adapter.disconnect();
    }

    isConnected(): boolean{
        return this.adapter.isConnected();
    }

    on(event: string, callback: (...args: unknown[]) => void): () => void{
        return this.adapter.on(event, callback);
    }

    off(event: string, callback?: (...args: unknown[]) => void): void{
        this.adapter.off(event, callback);
    }

    emit<T = unknown>(event: string, data?: unknown): Promise<T>{
        return this.adapter.emit(event, data);
    }

    updateAuth(auth: Record<string, unknown>): void{
        this.adapter.updateAuth(auth);
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void{
        return this.adapter.onConnectionChange(listener);
    }

    subscribeToTeam(teamId: string, previousTeamId?: string): void{
        this.adapter.subscribeToTeam(teamId, previousTeamId);
    }
};
