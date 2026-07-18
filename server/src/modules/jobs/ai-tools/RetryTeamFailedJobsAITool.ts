import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import JobsService from '@modules/jobs/services/JobsService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RetryTeamFailedJobsAITool extends AITool {
    readonly name = 'retry_team_failed_jobs';
    readonly description = 'Retry all failed jobs for a trajectory in the team.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    #service = new JobsService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.retryFailedJobs({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId
        });
        return { summary: `Retried ${value.retriedFrames} frames across ${value.affectedClusters} clusters.`, data: value };
    }
}
