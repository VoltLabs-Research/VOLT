import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class TeamClusterSelectionService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ) {}

    async resolveTeamClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string> {
        if (requestedTeamClusterId) {
            const requestedTeamCluster = await this.teamClusterRepository.findById(requestedTeamClusterId);
            if (!requestedTeamCluster || requestedTeamCluster.props.team !== teamId) {
                throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found for the requested team');
            }

            return requestedTeamCluster.id;
        }

        const teamClusters = await this.teamClusterRepository.findAll({
            filter: { team: teamId },
            page: 1,
            limit: 1,
            sort: { createdAt: -1 }
        });
        const defaultTeamCluster = teamClusters.data[0];
        if (!defaultTeamCluster) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'No team cluster is available for this team');
        }

        return defaultTeamCluster.id;
    }
};
