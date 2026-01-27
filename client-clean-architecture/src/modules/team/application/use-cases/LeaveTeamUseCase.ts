import type { ITeamRepository } from '../../domain/repositories';

export class LeaveTeamUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(teamId: string): Promise<void> {
        return this.teamRepository.leave(teamId);
    }
}
