import type { ISocketService } from '@/shared/domain/repositories';

export class ContainerTerminalSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    connect(): Promise<void> {
        return this.socketService.connect();
    }

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    sendInput(data: string): Promise<void> {
        return this.socketService.emit('container:terminal:input', data);
    }

    attach(containerId: string): Promise<void> {
        return this.socketService.emit('container:terminal:attach', { containerId });
    }

    detach(): Promise<void> {
        return this.socketService.emit('container:terminal:detach');
    }

    onData(callback: (data: string) => void): () => void {
        return this.socketService.on('container:terminal:data', callback);
    }

    onError(callback: (error: string) => void): () => void {
        return this.socketService.on('container:error', callback);
    }

    onConnectionChange(callback: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(callback);
    }
}
