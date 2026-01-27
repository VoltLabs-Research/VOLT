import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export interface CanvasPresencePayload {
    trajectoryId: string;
    previousTrajectoryId?: string;
}

export class CanvasPresenceSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(listener);
    }

    onCanvasUsersUpdate(callback: (users: any) => void): () => void {
        return this.socketService.on('canvas_users_update', callback);
    }

    onRasterUsersUpdate(callback: (users: any) => void): () => void {
        return this.socketService.on('raster_users_update', callback);
    }

    subscribeToCanvas(payload: CanvasPresencePayload): Promise<void> {
        return this.emit('subscribe_to_canvas', payload);
    }

    subscribeToRaster(payload: { trajectoryId: string }): Promise<void> {
        return this.emit('subscribe_to_raster', payload);
    }

    unsubscribeFromCanvas(payload: { trajectoryId: string }): Promise<void> {
        return this.emit('unsubscribe_from_canvas', payload);
    }

    unsubscribeFromRaster(payload: { trajectoryId: string }): Promise<void> {
        return this.emit('unsubscribe_from_raster', payload);
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
