import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { GetAnalysisListingExportOptionsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetAnalysisListingExportOptionsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListAnalysisResultOptionsAITool extends AITool {
    readonly name = 'list_analysis_result_options';
    readonly description = 'List the result exposures and sub-listings produced by an analysis, so you know what can be summarized or read before requesting it.';
    readonly parameters = z.object({
        analysisId: z.string()
    });

    constructor(
        protected readonly useCase: GetAnalysisListingExportOptionsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });
        if (!result.success) throw result.error;

        const value = result.value;
        return {
            summary: `Analysis has ${value.listings.length} listing(s) and ${value.subListings.length} sub-listing(s).`,
            data: value
        };
    }
}
