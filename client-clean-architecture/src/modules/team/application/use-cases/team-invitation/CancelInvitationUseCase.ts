import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type { CancelInvitationInputDTO } from '../../dtos/team-invitation';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class CancelInvitationUseCase implements IUseCase<CancelInvitationInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(data: CancelInvitationInputDTO): Promise<void>{
        await this.teamInvitationRepository.cancel(data.invitationId);
    }
};
