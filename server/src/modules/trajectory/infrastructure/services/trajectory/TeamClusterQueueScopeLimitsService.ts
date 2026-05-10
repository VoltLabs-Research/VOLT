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
    | 'trajectoryGlbConversion';

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
            maxRunningPerTrajectory: teamCluster.props.queueScopeLimits[queueKey].maxRunningPerTrajectory
        };
    }

    async getSnapshot(teamClusterId: string): Promise<TeamClusterQueueScopeLimitsProps> {
        const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
        if (!teamCluster) {
            throw new Error(`Team cluster ${teamClusterId} not found while resolving queue scope limits`);
        }

        return {
            analysisProcessing: {
                maxRunningPerTrajectory: teamCluster.props.queueScopeLimits.analysisProcessing.maxRunningPerTrajectory
            },
            artifactUpload: {
                maxRunningPerTrajectory: teamCluster.props.queueScopeLimits.artifactUpload.maxRunningPerTrajectory
            },
            trajectoryRasterization: {
                maxRunningPerTrajectory: teamCluster.props.queueScopeLimits.trajectoryRasterization.maxRunningPerTrajectory
            },
            trajectoryGlbConversion: {
                maxRunningPerTrajectory: teamCluster.props.queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory
            }
        };
    }
}
