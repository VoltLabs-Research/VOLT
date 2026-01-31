import { inject, injectable } from 'tsyringe';
import type ITeamMemberRepository from '../../../domain/ports/ITeamMemberRepository';
import type { GetAllTeamMembersInputDTO } from '../../dtos/team-member';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { TeamMember } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetAllTeamMembersUseCase implements IUseCase<GetAllTeamMembersInputDTO, TeamMember[]>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(data: GetAllTeamMembersInputDTO): Promise<TeamMember[]>{
        return this.teamMemberRepository.getAll(data.teamId);
    }
};
