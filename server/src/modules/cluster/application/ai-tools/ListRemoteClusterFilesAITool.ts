import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/cluster/application/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/domain/contracts/TeamClusterRemoteAccess';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListRemoteClusterFilesAITool extends AITool {
    readonly name = 'list_remote_cluster_files';
    readonly description = 'List the entries at a path inside a cluster\'s remote storage target (minio buckets, mongo collections, or redis data). Requires an active password-confirmed remote-access session id.';
    readonly parameters = z.object({
        clusterId: z.string(),
        sessionId: z.string().describe('An active remote-access session id, obtained after password confirmation for the chosen storage target.'),
        target: z.nativeEnum(TeamClusterRemoteAccessTargetDTO).describe('The remote storage target to browse: minio, mongo-documents, or redis-data.'),
        path: z.string().describe('The path within the target to list. Use an empty string for the root.')
    });

    constructor(
        protected readonly useCase: ListTeamClusterRemoteExplorerEntriesUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.clusterId,
            sessionId: params.sessionId,
            target: params.target,
            path: params.path
        });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.entries.length} entr${result.value.entries.length === 1 ? 'y' : 'ies'} at "${result.value.path || '/'}" in ${result.value.target}.`,
            data: result.value
        };
    }
}
