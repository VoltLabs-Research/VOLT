import { SystemRoleNames } from '@core/constants/system-roles';
import TeamModel from '@modules/team/models/team/TeamModel';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';

export default class DefaultTeamEnroller {
    #deploymentSettings = new DeploymentSettingsService();
    #membership = new TeamMembershipService();

    async enrollIfConfigured(userId: string): Promise<void> {
        const settings = await this.#deploymentSettings.getSettings();
        if (!settings.props.autoJoinNewMembers || !settings.props.defaultTeam) return;
        const team = await TeamModel.findById(settings.props.defaultTeam);
        if (!team) return;
        await this.#membership.addMemberToTeam(userId, String(team._id), SystemRoleNames.MEMBER);
    }
}
