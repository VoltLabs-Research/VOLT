import type { ITeamRoleRepository } from '../domain/repositories/ITeamRoleRepository';
import type { ITeamRoleAssignmentRepository } from '../domain/repositories/ITeamRoleAssignmentRepository';

export interface TeamRoleDependencies {
    teamRoleRepository: ITeamRoleRepository;
    teamRoleAssignmentRepository: ITeamRoleAssignmentRepository;
}

export interface TeamRoleUseCases {}

let dependencies: TeamRoleDependencies | null = null;
let useCases: TeamRoleUseCases | null = null;

const buildUseCases = (deps: TeamRoleDependencies): TeamRoleUseCases => ({});

export const registerTeamRoleDependencies = (deps: TeamRoleDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getTeamRoleUseCases = (): TeamRoleUseCases => {
    if (!dependencies) {
        throw new Error('Team role dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
