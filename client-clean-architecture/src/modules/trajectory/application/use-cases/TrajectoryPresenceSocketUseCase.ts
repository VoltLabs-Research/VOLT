import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class TrajectoryPresenceSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(listener);
    }

    onCanvasUsersUpdate(callback: (payload: { trajectoryId: string; users: any[] }) => void): () => void {
        return this.socketService.on('canvas_users_update', callback);
    }

    onRasterUsersUpdate(callback: (payload: { trajectoryId: string; users: any[] }) => void): () => void {
        return this.socketService.on('raster_users_update', callback);
    }

    observeCanvasPresence(trajectoryId: string): Promise<void> {
        return this.emit('observe_canvas_presence', { trajectoryId });
    }

    observeRasterPresence(trajectoryId: string): Promise<void> {
        return this.emit('observe_raster_presence', { trajectoryId });
    }

    private async emit(event: string, payload: any): Promise<void> {
        if (!this.socketService.isConnected()) return;
        try {
            await this.socketService.emit(event, payload);
        } catch {
            // Ignore emit failures
        }
    }
}
