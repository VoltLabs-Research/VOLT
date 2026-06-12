import type {
    TeamClusterQueueScopeLimitProps,
    TeamClusterQueueScopeLimitsProps
} from '@shared/contracts/types';
import type { ITeamClusterRepository } from '@shared/contracts/ports';
import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type {
    ITeamClusterQueueScopeLimitsService,
    TeamClusterScopedQueueLimitKey
} from '@modules/trajectory/domain/port/trajectory/ITeamClusterQueueScopeLimitsService';

export type { TeamClusterScopedQueueLimitKey } from '@modules/trajectory/domain/port/trajectory/ITeamClusterQueueScopeLimitsService';

@Singleton()
export default class TeamClusterQueueScopeLimitsService implements ITeamClusterQueueScopeLimitsService {
    constructor(

        @inject(CLUSTER_SERVICE_TOKENS.TeamClusterRepository)
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
