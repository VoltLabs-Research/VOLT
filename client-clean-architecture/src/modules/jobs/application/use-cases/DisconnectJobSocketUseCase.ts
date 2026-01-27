import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class DisconnectJobSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(): void {
        this.socketService.disconnect();
    }
}
