import type { ITeamRepository } from '../../domain/repositories';

export class RemoveTeamMemberUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(teamId: string, data: { userId?: string }): Promise<void> {
        return this.teamRepository.removeMember(teamId, data);
    }
}
