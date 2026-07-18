import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import TeamRoleModel from '@modules/team/models/team-role/TeamRoleModel';
import TeamInvitationModel from '@modules/team/models/team-invitation/TeamInvitationModel';
import SecretKeyModel from '@modules/team/models/secret-key/SecretKeyModel';
import SecretKeyUsageLogModel from '@modules/team/models/secret-key/SecretKeyUsageLogModel';
import TeamAIIntegrationModel from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        const query = { team: teamId };
        await Promise.all([
            TeamMemberModel.deleteMany(query),
            TeamRoleModel.deleteMany(query),
            TeamInvitationModel.deleteMany(query),
            SecretKeyModel.deleteMany(query),
            SecretKeyUsageLogModel.deleteMany(query),
            TeamAIIntegrationModel.deleteMany(query)
        ]);
    }
}
