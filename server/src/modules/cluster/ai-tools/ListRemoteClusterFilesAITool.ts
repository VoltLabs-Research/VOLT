import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListRemoteClusterFilesAITool extends AITool {
    readonly name = 'list_remote_cluster_files';
    readonly description = 'List the entries at a path inside a cluster\'s remote storage target (minio buckets, mongo collections, or redis data). Requires an active password-confirmed remote-access session id.';
    readonly parameters = z.object({
        clusterId: z.string(),
        sessionId: z.string().describe('An active remote-access session id, obtained after password confirmation for the chosen storage target.'),
        target: z.nativeEnum(TeamClusterRemoteAccessTargetDTO).describe('The remote storage target to browse: minio, mongo-documents, or redis-data.'),
        path: z.string().describe('The path within the target to list. Use an empty string for the root.')
    });

    #service = new ClusterService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.listRemoteExplorerEntries({
            teamId: scope.teamId,
            userId: scope.userId,
            teamClusterId: params.clusterId,
            sessionId: params.sessionId,
            target: params.target,
            path: params.path
        });
        return {
            summary: `Found ${result.entries.length} entr${result.entries.length === 1 ? 'y' : 'ies'} at "${result.path || '/'}" in ${result.target}.`,
            data: result
        };
    }
}
