import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/use-cases/RemoveTeamRunningJobsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class RemoveTeamRunningJobsAITool extends AITool {
    readonly name = 'remove_team_running_jobs';
    readonly description = 'Remove all running jobs for a trajectory in the team.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        protected readonly useCase: RemoveTeamRunningJobsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId
        });
        return { summary: `Removed ${value.deletedJobs} jobs across ${value.affectedClusters} clusters.`, data: value };
    }
}
