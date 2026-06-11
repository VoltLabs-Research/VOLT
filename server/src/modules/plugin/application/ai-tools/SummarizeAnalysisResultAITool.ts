import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { SummarizeAnalysisResultUseCase } from '@modules/plugin/application/use-cases/listing-row/SummarizeAnalysisResultUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class SummarizeAnalysisResultAITool extends AITool {
    readonly name = 'summarize_analysis_result';
    readonly description = 'Summarize an analysis result into per-column statistics (numeric: count/min/max/mean/stddev; categorical: distinct count and top values) so you can reason about the scientific output.';
    readonly parameters = z.object({
        analysisId: z.string(),
        exposureId: z.string().optional(),
        maxRows: z.number().optional()
    });

    constructor(
        protected readonly useCase: SummarizeAnalysisResultUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            exposureId: params.exposureId,
            maxRows: params.maxRows
        });
        if (!result.success) throw result.error;

        const value = result.value;
        if (!value.hasResults) {
            return { summary: value.note ?? 'No results available.', data: value };
        }

        const columnCount = value.exposures.reduce((sum, exposure) => sum + exposure.columns.length, 0);
        const summary = `Analysis "${value.pluginDisplayName}"${value.trajectoryName ? ` on trajectory "${value.trajectoryName}"` : ''}: `
            + `${value.rowCount.toLocaleString('en-US')} rows across ${value.exposures.length} exposure(s), ${columnCount} columns summarized.`;

        return { summary, data: value };
    }
}
