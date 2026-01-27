import type { ITeamRepository } from '../../domain/repositories';

export class DeleteTeamUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(teamId: string): Promise<void> {
        return this.teamRepository.delete(teamId);
    }
}
