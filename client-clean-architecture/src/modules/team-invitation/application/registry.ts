import type { ITeamInvitationRepository } from '../domain/repositories';

export interface TeamInvitationDependencies {
    teamInvitationRepository: ITeamInvitationRepository;
}

export interface TeamInvitationUseCases {}

let dependencies: TeamInvitationDependencies | null = null;
let useCases: TeamInvitationUseCases | null = null;

const buildUseCases = (deps: TeamInvitationDependencies): TeamInvitationUseCases => ({});

export const registerTeamInvitationDependencies = (deps: TeamInvitationDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getTeamInvitationUseCases = (): TeamInvitationUseCases => {
    if (!dependencies) {
        throw new Error('Team invitation dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
