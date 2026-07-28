import { SystemRoleNames } from '@core/constants/system-roles';
import Team from '@modules/team/models/Team';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';

export default class DefaultTeamEnroller{
    #deploymentSettings = new DeploymentSettingsService();
    #membership = new TeamMembershipService();

    async enrollIfConfigured(userId: string): Promise<void>{
        const settings = await this.#deploymentSettings.getSettings();
        if(!settings.props.autoJoinNewMembers || !settings.props.defaultTeam) return;
        const team = await Team.findOneBy({ id: settings.props.defaultTeam });
        if(!team) return;
        await this.#membership.addMemberToTeam(userId, team.id, SystemRoleNames.MEMBER);
    }
}
