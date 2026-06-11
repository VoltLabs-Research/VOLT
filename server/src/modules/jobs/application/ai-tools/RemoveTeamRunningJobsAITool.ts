import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId
        });
        if (!result.success) throw result.error;
        return { summary: `Removed ${result.value.deletedJobs} jobs across ${result.value.affectedClusters} clusters.`, data: result.value };
    }
}
