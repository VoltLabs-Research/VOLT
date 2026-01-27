import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class TrajectoryUpdatesSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    onUpdated(callback: (payload: any) => void): () => void {
        return this.socketService.on('trajectory.updated', callback);
    }

    onCreated(callback: () => void): () => void {
        return this.socketService.on('trajectory.created', callback);
    }

    onDeleted(callback: () => void): () => void {
        return this.socketService.on('trajectory.deleted', callback);
    }
}
