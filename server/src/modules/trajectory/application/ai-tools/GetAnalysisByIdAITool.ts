import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';

@injectable()
export class GetAnalysisByIdAITool extends AITool {
    readonly name = 'get_analysis_by_id';
    readonly description = 'Get detailed information about a specific analysis by its ID.';
    readonly parameters = z.object({ analysisId: z.string() });

    constructor(
        @inject(GetAnalysisByIdUseCase)
        protected readonly useCase: GetAnalysisByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ analysisId: params.analysisId });
        if (!result.success) throw result.error;
        const { plugin, trajectory, status, totalFrames, completedFrames, config, startedAt, finishedAt, createdAt } = result.value;
        return { analysisId: params.analysisId, pluginId: plugin, trajectoryId: trajectory, status, totalFrames, completedFrames, config: config ?? null, startedAt, finishedAt, createdAt };
    }
}
