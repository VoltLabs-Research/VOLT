import { SystemRoleNames } from '@core/constants/system-roles';
import type { IDeploymentSettingsRepository } from '@modules/system/domain/port/IDeploymentSettingsRepository';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/domain/port/team/INewMemberDefaultTeamEnroller';
import type { ITeamMembershipService } from '@modules/team/domain/port/team/ITeamMembershipService';
import type { ITeamRepository } from '@modules/team/domain/port/team/ITeamRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton(TEAM_TOKENS.DefaultTeamEnroller)
export default class DefaultTeamEnroller implements INewMemberDefaultTeamEnroller {
    constructor(
        @inject(SYSTEM_TOKENS.DeploymentSettingsRepository)
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
