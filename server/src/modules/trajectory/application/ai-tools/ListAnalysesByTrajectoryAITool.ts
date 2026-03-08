import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';

@injectable()
export class ListAnalysesByTrajectoryAITool extends AITool {
    readonly name = 'list_analyses_by_trajectory';
    readonly description = 'List analyses for a specific trajectory.';
    readonly parameters = z.object({ trajectoryId: z.string() });

    constructor(
        @inject(GetAnalysesByTrajectoryIdUseCase)
        protected readonly useCase: GetAnalysesByTrajectoryIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ trajectoryId: params.trajectoryId, page: 1, limit: 500 });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.data.length} analyses.`,
            data: result.value.data.map((a: any) => ({
                analysisId: a._id, pluginId: a.plugin, pluginName: a.pluginDisplayName || a.plugin,
                status: a.status, totalFrames: a.totalFrames ?? null, completedFrames: a.completedFrames ?? null,
                createdAt: a.createdAt ?? null
            }))
        };
    }
}
