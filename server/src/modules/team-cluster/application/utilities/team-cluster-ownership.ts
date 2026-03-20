import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

export interface OwnedTeamClusterInput {
    teamClusterId: string;
    teamId: string;
};

type TeamClusterLoader = (teamClusterId: string) => Promise<TeamCluster | null>;

const createTeamClusterNotFoundError = (): ApplicationError => {
    return ApplicationError.notFound(
        'TeamCluster::NotFound',
        'Team cluster not found'
    );
};

const requireOwnedTeamClusterFromLoader = async (
    loadTeamCluster: TeamClusterLoader,
    input: OwnedTeamClusterInput
): Promise<TeamCluster | ApplicationError> => {
    const teamCluster = await loadTeamCluster(input.teamClusterId);
    if (!teamCluster || teamCluster.props.team !== input.teamId) {
        return createTeamClusterNotFoundError();
    }

    return teamCluster;
};

export const requireOwnedTeamCluster = async (
    repository: ITeamClusterRepository,
    input: OwnedTeamClusterInput
): Promise<TeamCluster | ApplicationError> => {
    return requireOwnedTeamClusterFromLoader(repository.findById.bind(repository), input);
};

export const requireOwnedTeamClusterWithSensitiveData = async (
    repository: ITeamClusterRepository,
    input: OwnedTeamClusterInput
): Promise<TeamCluster | ApplicationError> => {
    return requireOwnedTeamClusterFromLoader(repository.findByIdWithSensitiveData.bind(repository), input);
};
