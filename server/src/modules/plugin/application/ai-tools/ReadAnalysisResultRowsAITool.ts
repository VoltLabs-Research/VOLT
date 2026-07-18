import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ReadAnalysisResultRowsAITool extends AITool {
    readonly name = 'read_analysis_result_rows';
    readonly description = 'Read individual rows of an analysis result table (paginated) when you need concrete values rather than aggregate statistics.';
    readonly parameters = z.object({
        analysisId: z.string(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        protected readonly useCase: GetListingRowsByAnalysisIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });

        const value = result;
        return {
            summary: `Returned ${value.data.length} of ${value.total} result rows (page ${value.page}/${value.totalPages || 1}).`,
            data: value
        };
    }
}
