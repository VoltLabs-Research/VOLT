import type { ITeamRepository } from '../../domain/repositories';
import type { CreateTeamPayload, Team } from '../../domain/entities';

export class CreateTeamUseCase {
    constructor(private readonly teamRepository: ITeamRepository) {}

    async execute(data: CreateTeamPayload): Promise<Team> {
        return this.teamRepository.create(data);
    }
}
