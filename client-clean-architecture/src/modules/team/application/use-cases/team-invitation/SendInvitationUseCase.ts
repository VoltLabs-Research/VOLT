import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type { SendInvitationInputDTO } from '../../dtos/team-invitation';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class SendInvitationUseCase implements IUseCase<SendInvitationInputDTO, void>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(data: SendInvitationInputDTO): Promise<void>{
        await this.teamInvitationRepository.send(data.email, data.role);
    }
};
