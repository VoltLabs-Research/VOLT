import type { ITeamRepository } from '../../domain/repositories';
import type { UpdateTeamPayload, Team } from '../../domain/entities';

export class UpdateTeamUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(teamId: string, data: UpdateTeamPayload): Promise<Team> {
        return this.teamRepository.update(teamId, data);
    }
}
