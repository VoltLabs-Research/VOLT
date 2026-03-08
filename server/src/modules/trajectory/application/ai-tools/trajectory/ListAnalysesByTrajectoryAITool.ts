import type { GetAnalysesByTrajectoryItemDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import { AITool } from '@shared/application/ai/AITool';

import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

import type { AIToolScope } from '@modules/ai/services/AIToolService';

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
        const result = await this.useCase.execute({
            trajectoryId: params.trajectoryId,
            page: 1,
            limit: 500
        });
        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.data.length} analyses.`,
            data: result.value.data.map((analysis: GetAnalysesByTrajectoryItemDTO) => ({
                analysisId: analysis._id,
                pluginId: analysis.plugin,
                pluginName: analysis.pluginDisplayName || analysis.plugin,
                status: analysis.status,
                totalFrames: analysis.totalFrames ?? null,
                completedFrames: analysis.completedFrames ?? null,
                createdAt: analysis.createdAt ?? null
            }))
        };
    }
};
