import { SystemRoleNames } from '@core/constants/system-roles';
import Team from '@modules/team/models/Team';
import teamMembershipService from '@modules/team/services/team/TeamMembershipService';
import deploymentSettingsService from '@modules/system/services/DeploymentSettingsService';

class DefaultTeamEnroller{
    async enrollIfConfigured(userId: string): Promise<void>{
        const settings = await deploymentSettingsService.getSettings();
        if(!settings.props.autoJoinNewMembers || !settings.props.defaultTeam) return;
        const team = await Team.findOneBy({ id: settings.props.defaultTeam });
        if(!team) return;
        await teamMembershipService.addMemberToTeam(userId, team.id, SystemRoleNames.MEMBER);
    }
}

export default new DefaultTeamEnroller();
