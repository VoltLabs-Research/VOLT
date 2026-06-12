import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RetryTeamFailedJobsAITool extends AITool {
    readonly name = 'retry_team_failed_jobs';
    readonly description = 'Retry all failed jobs for a trajectory in the team.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        protected readonly useCase: RetryTeamFailedJobsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId
        });
        if (!result.success) throw result.error;
        return { summary: `Retried ${result.value.retriedFrames} frames across ${result.value.affectedClusters} clusters.`, data: result.value };
    }
}
