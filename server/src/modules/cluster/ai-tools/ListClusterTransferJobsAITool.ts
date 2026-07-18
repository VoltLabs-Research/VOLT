import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import type { ClusterTransferJobState } from '@modules/cluster/utilities/cluster-transfer-job';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListClusterTransferJobsAITool extends AITool {
    readonly name = 'list_cluster_transfer_jobs';
    readonly description = 'List data transfer jobs for a cluster.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        state: z.enum([
            'queued',
            'freezing',
            'copying',
            'verifying',
            'switching',
            'cleaning',
            'completed',
            'failed',
            'cancelled'
        ]).optional()
    });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.listTransferJobs({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId,
            page: params.page,
            limit: params.limit,
            state: params.state as ClusterTransferJobState | undefined
        });
        return { summary: `Found ${result.total} transfer jobs.`, data: result.data };
    }
}
