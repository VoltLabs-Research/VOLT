import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const queueScopeLimit = z.object({ maxRunningPerTrajectory: z.number() });

@CollectionMember(AI_TOKENS.AITool)
export class UpdateClusterQueueConcurrencyAITool extends AITool {
    readonly name = 'update_cluster_queue_concurrency';
    readonly description = 'Update the queue concurrency and scope limits of a cluster.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        queueConcurrency: z.object({
            analysis: z.number(),
            rasterizer: z.number(),
            glbPreprocessing: z.number(),
            artifactUpload: z.number(),
            pluginWarmup: z.number()
        }),
        queueScopeLimits: z.object({
            analysisProcessing: queueScopeLimit,
            artifactUpload: queueScopeLimit,
            trajectoryRasterization: queueScopeLimit,
            trajectoryGlbConversion: queueScopeLimit
        })
    });

    constructor(
        protected readonly useCase: UpdateTeamClusterQueueConcurrencyUseCase
    ) {
        super();
    }
}
