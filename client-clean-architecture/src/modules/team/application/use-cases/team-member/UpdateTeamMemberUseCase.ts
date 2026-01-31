import { inject, injectable } from 'tsyringe';
import type ITeamMemberRepository from '../../../domain/ports/ITeamMemberRepository';
import type { UpdateTeamMemberInputDTO } from '../../dtos/team-member';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { TeamMember } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class UpdateTeamMemberUseCase implements IUseCase<UpdateTeamMemberInputDTO, TeamMember>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(data: UpdateTeamMemberInputDTO): Promise<TeamMember>{
        return this.teamMemberRepository.update(data.teamId, data.memberId, data);
    }
};
