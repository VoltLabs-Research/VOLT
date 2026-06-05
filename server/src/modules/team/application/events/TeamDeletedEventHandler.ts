import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import type SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import type SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import type TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository) private readonly teamRoleRepository: TeamRoleRepository,
        @inject(TEAM_TOKENS.TeamInvitationRepository) private readonly teamInvitationRepository: TeamInvitationRepository,
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: SecretKeyRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository) private readonly secretKeyUsageLogRepository: SecretKeyUsageLogRepository,
        @inject(TEAM_TOKENS.TeamAIIntegrationRepository) private readonly teamAIIntegrationRepository: TeamAIIntegrationRepository
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
