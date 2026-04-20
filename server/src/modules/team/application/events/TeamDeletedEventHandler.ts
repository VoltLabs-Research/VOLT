import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';
import type { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import type { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/secret-key/ISecretKeyUsageLogRepository';
import type { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import type { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { ITeamRoleRepository } from '@modules/team/domain/port/team-role/ITeamRoleRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(TEAM_TOKENS.TeamRoleRepository)
        private readonly teamRoleRepository: ITeamRoleRepository,

        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly teamInvitationRepository: ITeamInvitationRepository,

        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository)
        private readonly secretKeyUsageLogRepository: ISecretKeyUsageLogRepository,

        @inject(TEAM_TOKENS.TeamAIIntegrationRepository)
        private readonly teamAIIntegrationRepository: ITeamAIIntegrationRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        const query = { team: teamId };

        await Promise.all([
            this.teamRoleRepository.deleteMany(query),
            this.teamMemberRepository.deleteMany(query),
            this.teamInvitationRepository.deleteMany(query),
            this.secretKeyRepository.deleteMany(query),
            this.secretKeyUsageLogRepository.deleteMany(query),
            this.teamAIIntegrationRepository.deleteMany(query)
        ]);
    }
};
