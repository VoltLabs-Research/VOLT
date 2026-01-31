import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type { RejectInvitationInputDTO } from '../../dtos/team-invitation';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class RejectInvitationUseCase implements IUseCase<RejectInvitationInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(data: RejectInvitationInputDTO): Promise<void>{
        await this.teamInvitationRepository.reject(data.invitationId);
    }
};
