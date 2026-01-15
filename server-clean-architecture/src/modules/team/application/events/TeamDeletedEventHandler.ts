import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import TeamDeletedEvent from '../../domain/events/TeamDeletedEvent';
import { TEAM_TOKENS } from '../../infrastructure/di/TeamTokens';
import { ITeamMemberRepository } from '../../domain/ports/ITeamMemberRepository';
import { ITeamRoleRepository } from '../../domain/ports/ITeamRoleRepository';
import { ITeamInvitationRepository } from '../../domain/ports/ITeamInvitationRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        const query = { team: teamId };

        await Promise.all([
            this.teamRoleRepository.deleteMany(query),
            this.teamMemberRepository.deleteMany(query),
            this.teamInvitationRepository.deleteMany(query)
            
        ]);
    }
};