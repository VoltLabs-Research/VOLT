import type { ITeamRepository } from '../../domain/repositories';
import type { Team } from '../../domain/entities';

export class GetUserTeamsUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(): Promise<Team[]> {
        return this.teamRepository.getAll();
    }
}
