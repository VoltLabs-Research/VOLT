import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class SubscribeToTeamJobsUseCase {
    constructor(private readonly socketService: ISocketService) {}

    async execute(teamId: string, previousTeamId?: string | null): Promise<void> {
        if (!this.socketService.isConnected()) {
            await this.socketService.connect();
        }

        this.socketService.subscribeToTeam(teamId, previousTeamId ?? undefined);
    }
}
