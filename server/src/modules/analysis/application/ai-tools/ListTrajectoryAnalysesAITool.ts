import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListTrajectoryAnalysesAITool extends AITool {
    readonly name = 'list_trajectory_analyses';
    readonly description = 'List all analyses for a specific trajectory.';
    readonly parameters = z.object({
        trajectoryId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        protected readonly useCase: GetAnalysesByTrajectoryIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            trajectoryId: params.trajectoryId,
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} analyses for trajectory ${params.trajectoryId}.`, data: result.value.data };
    }
}
