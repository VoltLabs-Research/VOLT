import { registerTeamRoleDependencies } from '../application/registry';
import { teamRoleRepository, teamRoleAssignmentRepository } from './index';

export const registerTeamRoleInfrastructure = (): void => {
    registerTeamRoleDependencies({
        teamRoleRepository,
        teamRoleAssignmentRepository
    });
};
