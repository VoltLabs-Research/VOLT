import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import SecretKey from '@modules/team/models/SecretKey';
import SecretKeyUsageLog from '@modules/team/models/SecretKeyUsageLog';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import TeamInvitation from '@modules/team/models/TeamInvitation';
import TeamMember from '@modules/team/models/TeamMember';
import TeamRole from '@modules/team/models/TeamRole';
import CatalogFolder from '@shared/infrastructure/persistence/models/CatalogFolder';

@DefineEventGroup('team')
export default class TeamEvents{
    @Event('team.deleted')
    async deleteTeamScopedRecords({ teamId }: EventMap['team.deleted']){
        const filter = { team: teamId };

        await SecretKeyUsageLog.delete(filter);
        await SecretKey.delete(filter);
        await TeamInvitation.delete(filter);
        await TeamMember.delete(filter);
        await TeamAIIntegration.delete(filter);
        await TeamRole.delete(filter);
    }

    @Event('team.deleted')
    async deleteCatalogFolders({ teamId }: EventMap['team.deleted']){
        await CatalogFolder.delete({ team: teamId });
    }

    @Event('user.deleted')
    async deleteMemberships({ userId }: EventMap['user.deleted']){
        await TeamMember.delete({ user: userId });
    }
}
