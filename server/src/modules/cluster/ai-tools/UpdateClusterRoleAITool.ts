import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateClusterRoleAITool extends AITool {
    readonly name = 'update_cluster_role';
    readonly description = 'Update the desired role of a cluster.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        role: z.enum(['cluster', 'storage-server', 'compute-node'])
    });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateRole({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.teamClusterId,
            role: params.role
        });
    }
}
