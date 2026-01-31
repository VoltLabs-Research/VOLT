import { inject, injectable } from 'tsyringe';
import type ITeamInvitationRepository from '../../../domain/ports/ITeamInvitationRepository';
import type { GetInvitationDetailsInputDTO } from '../../dtos/team-invitation';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type { TeamInvitation } from '../../../domain/entities';
import { TEAM_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetInvitationDetailsUseCase implements IUseCase<GetInvitationDetailsInputDTO, TeamInvitation>{
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async execute(data: GetInvitationDetailsInputDTO): Promise<TeamInvitation>{
        return this.teamInvitationRepository.getDetails(data.invitationId);
    }
};
