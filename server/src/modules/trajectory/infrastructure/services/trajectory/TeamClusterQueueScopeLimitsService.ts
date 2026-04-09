import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { injectable, inject } from 'tsyringe';
import type {
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps
} from '@modules/team-cluster/domain/entities/TeamCluster';

export type TeamClusterScopedQueueLimitKey =
    | 'analysisProcessing'
    | 'artifactUpload'
    | 'trajectoryGlbConversion'
    | 'cloudUpload'
    | 'trajectoryCompression';

@injectable()
export default class TeamClusterQueueScopeLimitsService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ) {}

    async getLimits(
        teamClusterId: string,
        queueKey: TeamClusterScopedQueueLimitKey
    ): Promise<TeamClusterQueueScopeLimitProps> {
        const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
        if (!teamCluster) {
            throw new Error(`Team cluster ${teamClusterId} not found while resolving queue scope limits`);
        }

        return {
            ...teamCluster.props.queueScopeLimits[queueKey]
        };
    }

    async getSnapshot(teamClusterId: string): Promise<TeamClusterQueueScopeLimitsProps> {
        const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
        if (!teamCluster) {
            throw new Error(`Team cluster ${teamClusterId} not found while resolving queue scope limits`);
        }

        return {
            analysisProcessing: {
                ...teamCluster.props.queueScopeLimits.analysisProcessing
            },
            artifactUpload: {
                ...teamCluster.props.queueScopeLimits.artifactUpload
            },
            trajectoryGlbConversion: {
                ...teamCluster.props.queueScopeLimits.trajectoryGlbConversion
            },
            cloudUpload: {
                ...teamCluster.props.queueScopeLimits.cloudUpload
            },
            trajectoryCompression: {
                ...teamCluster.props.queueScopeLimits.trajectoryCompression
            }
        };
    }
}
