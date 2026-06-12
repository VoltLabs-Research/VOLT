import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ListTeamClusterTransferJobsUseCase from '@modules/cluster/application/use-cases/ListTeamClusterTransferJobsUseCase';
import type { ClusterTransferJobState } from '@modules/cluster/domain/entities/ClusterTransferJob';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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

    constructor(
        protected readonly useCase: ListTeamClusterTransferJobsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            teamClusterId: params.teamClusterId,
            page: params.page,
            limit: params.limit,
            state: params.state as ClusterTransferJobState | undefined
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} transfer jobs.`, data: result.value.data };
    }
}
