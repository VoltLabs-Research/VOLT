import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type { AcceptInvitationInputDTO } from '../../dtos/team-invitation';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class AcceptInvitationUseCase implements IUseCase<AcceptInvitationInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(data: AcceptInvitationInputDTO): Promise<void>{
        await this.teamInvitationRepository.accept(data.invitationId);
    }
};
