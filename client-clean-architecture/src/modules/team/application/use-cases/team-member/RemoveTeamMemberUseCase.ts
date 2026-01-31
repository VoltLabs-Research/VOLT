import { inject, injectable } from 'tsyringe';
import type ITeamMemberRepository from '../../../domain/ports/ITeamMemberRepository';
import type { RemoveTeamMemberInputDTO } from '../../dtos/team-member';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class RemoveTeamMemberUseCase implements IUseCase<RemoveTeamMemberInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(data: RemoveTeamMemberInputDTO): Promise<void>{
        await this.teamMemberRepository.remove(data.teamId, data.userId);
    }
};
