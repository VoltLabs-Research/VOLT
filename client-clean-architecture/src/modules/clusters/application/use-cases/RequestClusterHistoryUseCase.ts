import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class RequestClusterHistoryUseCase {
    constructor(private readonly socketService: ISocketService) {}

    async execute(range: number): Promise<void> {
        if (!this.socketService.isConnected()) return;
        try {
            await this.socketService.emit('metrics:history', range);
        } catch {
            // Ignore emit failures
        }
    }
}
