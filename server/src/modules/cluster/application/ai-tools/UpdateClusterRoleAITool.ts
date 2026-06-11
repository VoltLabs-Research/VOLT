import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import UpdateTeamClusterRoleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class UpdateClusterRoleAITool extends AITool {
    readonly name = 'update_cluster_role';
    readonly description = 'Update the desired role of a cluster.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        role: z.enum(['cluster', 'storage-server', 'compute-node'])
    });

    constructor(
        protected readonly useCase: UpdateTeamClusterRoleUseCase
    ) {
        super();
    }
}
