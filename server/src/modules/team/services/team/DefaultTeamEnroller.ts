import { SystemRoleNames } from '@core/constants/system-roles';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/ports/team/INewMemberDefaultTeamEnroller';
import type { ITeamMembershipService } from '@modules/team/ports/team/ITeamMembershipService';
import type { ITeamRepository } from '@modules/team/ports/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { IDeploymentSettingsRepository } from '@shared/contracts/ports';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton(TEAM_TOKENS.DefaultTeamEnroller)
export default class DefaultTeamEnroller implements INewMemberDefaultTeamEnroller {
    constructor(
        @inject(SYSTEM_CONTRACT_TOKENS.DeploymentSettingsRepository)
        private readonly deploymentSettingsRepository: IDeploymentSettingsRepository,

        @inject(TEAM_TOKENS.TeamMembershipService)
        private readonly membershipService: ITeamMembershipService,

        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ) {}

    async enrollIfConfigured(userId: string): Promise<void> {
        const settings = await this.deploymentSettingsRepository.getSettings();
        if (!settings.props.autoJoinNewMembers || !settings.props.defaultTeam) return;
        const team = await this.teamRepository.findById(settings.props.defaultTeam);
        if (!team) return;
        await this.membershipService.addMemberToTeam(userId, team._id, SystemRoleNames.MEMBER);
    }
}
