import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { TeamInvitation } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetPendingInvitationsUseCase implements IUseCase<void, TeamInvitation[]>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(): Promise<TeamInvitation[]>{
        return this.teamInvitationRepository.getPending();
    }
};
