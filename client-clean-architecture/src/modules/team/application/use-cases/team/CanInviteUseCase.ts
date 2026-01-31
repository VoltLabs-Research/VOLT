import { inject, injectable } from 'tsyringe';
import type ITeamRepository from '../../../domain/ports/ITeamRepository';
import type { CanInviteInputDTO, CanInviteOutputDTO } from '../../dtos/team';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class CanInviteUseCase implements IUseCase<CanInviteInputDTO, CanInviteOutputDTO>{
    constructor(
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ){}

    async execute({ teamId }: CanInviteInputDTO): Promise<CanInviteOutputDTO>{
        const canInvite = await this.teamRepository.canInvite(teamId);
        return { canInvite };
    }
};
