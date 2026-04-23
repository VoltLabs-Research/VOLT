import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import TeamAIIntegrationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/ai-integration/TeamAIIntegrationRepository';
import SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import TeamInvitationRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-invitation/TeamInvitationRepository';
import TeamMemberRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-member/TeamMemberRepository';
import TeamRoleRepository from '@modules/team/infrastructure/persistence/mongo/repositories/team-role/TeamRoleRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        
        private readonly teamMemberRepository: TeamMemberRepository,

        
        private readonly teamRoleRepository: TeamRoleRepository,

        
        private readonly teamInvitationRepository: TeamInvitationRepository,

        
        private readonly secretKeyRepository: SecretKeyRepository,

        
        private readonly secretKeyUsageLogRepository: SecretKeyUsageLogRepository,

        
        private readonly teamAIIntegrationRepository: TeamAIIntegrationRepository
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
