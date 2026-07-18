import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const queueScopeLimit = z.object({ maxRunningPerTrajectory: z.number() });

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

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateQueueConcurrency({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId,
            queueConcurrency: params.queueConcurrency,
            queueScopeLimits: params.queueScopeLimits
        });
    }
}
