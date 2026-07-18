import { SystemRoleNames } from '@core/constants/system-roles';
import TeamModel from '@modules/team/models/team/TeamModel';
import TeamMembershipService from '@modules/team/services/team/TeamMembershipService';
import type { IDeploymentSettingsRepository } from '@shared/contracts/ports';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { container as diContainer } from 'tsyringe';

@Singleton(TEAM_CONTRACT_TOKENS.DefaultTeamEnroller)
export default class DefaultTeamEnroller {
    #deploymentSettings = diContainer.resolve<IDeploymentSettingsRepository>(SYSTEM_CONTRACT_TOKENS.DeploymentSettingsRepository);
    #membership = new TeamMembershipService();

    async enrollIfConfigured(userId: string): Promise<void> {
        const settings = await this.#deploymentSettings.getSettings();
        if (!settings.props.autoJoinNewMembers || !settings.props.defaultTeam) return;
        const team = await TeamModel.findById(settings.props.defaultTeam);
        if (!team) return;
        await this.#membership.addMemberToTeam(userId, String(team._id), SystemRoleNames.MEMBER);
    }
}
