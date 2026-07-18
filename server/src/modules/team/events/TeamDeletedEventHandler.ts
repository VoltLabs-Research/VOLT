import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamAIIntegrationRepository } from '@modules/team/ports/ai-integration/ITeamAIIntegrationRepository';
import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import type { ISecretKeyUsageLogRepository } from '@modules/team/ports/secret-key/ISecretKeyUsageLogRepository';
import type { ITeamInvitationRepository } from '@modules/team/ports/team-invitation/ITeamInvitationRepository';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: ITeamRoleRepository,
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly teamInvitationRepository: ITeamInvitationRepository,
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: ISecretKeyRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository) private readonly secretKeyUsageLogRepository: ISecretKeyUsageLogRepository,
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly teamAIIntegrationRepository: ITeamAIIntegrationRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        const query = { team: teamId };
        await Promise.all([
            this.teamMemberRepository.deleteMany(query),
            this.teamRoleRepository.deleteMany(query),
            this.teamInvitationRepository.deleteMany(query),
            this.secretKeyRepository.deleteMany(query),
            this.secretKeyUsageLogRepository.deleteMany(query),
            this.teamAIIntegrationRepository.deleteMany(query)
        ]);
    }
}
