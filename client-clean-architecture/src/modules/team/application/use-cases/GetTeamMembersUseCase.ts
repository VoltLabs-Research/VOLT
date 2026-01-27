import type { ITeamMemberRepository } from '../../domain/repositories';
import type { TeamMembersResponse } from '../../domain/entities';

export class GetTeamMembersUseCase {
    constructor(private readonly teamMemberRepository: ITeamMemberRepository) {}

    async execute(): Promise<TeamMembersResponse> {
        return this.teamMemberRepository.getAll();
    }
}
