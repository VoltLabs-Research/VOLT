import type { ISocketService } from '@/shared/domain/repositories/ISocketService';

export class SubscribeToTeamSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(teamId: string, previousTeamId?: string): void {
        this.socketService.subscribeToTeam(teamId, previousTeamId);
    }
}
