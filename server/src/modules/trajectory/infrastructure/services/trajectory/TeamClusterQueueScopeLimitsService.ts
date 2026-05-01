import type {
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps
} from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';

export type TeamClusterScopedQueueLimitKey =
    | 'analysisProcessing'
    | 'artifactUpload'
    | 'trajectoryRasterization'
    | 'trajectoryGlbConversion'
    | 'cloudUpload'
    | 'trajectoryCompression';

@Singleton()
export default class TeamClusterQueueScopeLimitsService {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository
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
            trajectoryRasterization: {
                ...teamCluster.props.queueScopeLimits.trajectoryRasterization
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
