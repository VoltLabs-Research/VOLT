import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RegenerateClusterTokenAITool extends AITool {
    readonly name = 'regenerate_cluster_token';
    readonly description = 'Rotate a cluster\'s enrollment token. Only valid while the cluster is waiting for connection or disconnected.';
    readonly parameters = z.object({ clusterId: z.string() });
    protected readonly needsApproval = true;

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.regenerateEnrollmentToken({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.clusterId
        });
        return {
            summary: 'Cluster enrollment token regenerated.',
            data: { enrollmentToken: result.enrollmentToken }
        };
    }
}
