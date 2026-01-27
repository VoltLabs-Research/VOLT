import { registerTeamInvitationDependencies } from '../application/registry';
import { teamInvitationRepository } from './repositories/TeamInvitationRepository';

export const registerTeamInvitationInfrastructure = (): void => {
    registerTeamInvitationDependencies({
        teamInvitationRepository
    });
};
