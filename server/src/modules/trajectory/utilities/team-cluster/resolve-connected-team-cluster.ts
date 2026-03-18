import TeamCluster, { TeamClusterStatus, TeamClusterRole } from '@modules/team-cluster/domain/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

interface ResolveConnectedTeamClusterInput {
    teamId: string;
    requestedTeamClusterId?: string;
    requiredRoles?: TeamClusterRole[];
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

        if (input.requiredRoles?.length) {
            const role = requestedTeamCluster.props.role ?? TeamClusterRole.Cluster;
            if (!input.requiredRoles.includes(role)) {
                throw ApplicationError.badRequest(
                    'TeamCluster::InvalidRole',
                    `Cluster role "${role}" is not allowed for this operation`
                );
            }
        }

        return requestedTeamCluster;
    }

    const filter: Record<string, unknown> = {
        team: input.teamId,
        status: TeamClusterStatus.Connected
    };

    if (input.requiredRoles?.length) {
        filter.role = { $in: input.requiredRoles };
    }

    const teamClusters = await teamClusterRepository.findAll({
        filter,
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
