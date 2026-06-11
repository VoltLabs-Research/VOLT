import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetTeamMetricsAITool extends AITool {
    readonly name = 'get_trajectory_team_metrics';
    readonly description = 'Get aggregate trajectory and storage metrics for the team.';
    readonly parameters = z.object({});

    constructor(
        protected readonly useCase: GetTeamMetricsUseCase
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId });
        if (!result.success) throw result.error;
        return { summary: 'Retrieved team trajectory metrics.', data: result.value };
    }
}
