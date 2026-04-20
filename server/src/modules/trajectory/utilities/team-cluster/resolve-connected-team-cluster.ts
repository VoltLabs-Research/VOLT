import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

interface ResolveConnectedTeamClusterInput {
    teamId: string;
    requestedTeamClusterId?: string;
};

const buildMissingTeamClusterError = (): ApplicationError => {
    return ApplicationError.conflict(
        'TeamCluster::ConnectedClusterRequired',
        'A connected team cluster is required for this operation'
    );
};

export const resolveConnectedTeamCluster = async (
    teamClusterRepository: ITeamClusterRepository,
    input: ResolveConnectedTeamClusterInput
): Promise<TeamCluster> => {
    if (input.requestedTeamClusterId) {
        const requestedTeamCluster = await teamClusterRepository.findById(input.requestedTeamClusterId);
        if (!requestedTeamCluster || requestedTeamCluster.props.team !== input.teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        if (requestedTeamCluster.props.status !== TeamClusterStatus.Connected) {
            throw buildMissingTeamClusterError();
        }

        return requestedTeamCluster;
    }

    const teamClusters = await teamClusterRepository.findAll({
        filter: {
            team: input.teamId,
            status: TeamClusterStatus.Connected
        },
        sort: {
            createdAt: 1
        },
        page: 1,
        limit: 1
    });

    const defaultTeamCluster = teamClusters.data[0];
    if (!defaultTeamCluster) {
        throw buildMissingTeamClusterError();
    }

    return defaultTeamCluster;
};
