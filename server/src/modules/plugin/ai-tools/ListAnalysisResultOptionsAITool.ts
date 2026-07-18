import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListAnalysisResultOptionsAITool extends AITool {
    readonly name = 'list_analysis_result_options';
    readonly description = 'List the result exposures and sub-listings produced by an analysis, so you know what can be summarized or read before requesting it.';
    readonly parameters = z.object({
        analysisId: z.string()
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.getAnalysisListingExportOptions({
            analysisId: params.analysisId,
            teamId: scope.teamId
        });

        const value = result;
        return {
            summary: `Analysis has ${value.listings.length} listing(s) and ${value.subListings.length} sub-listing(s).`,
            data: value
        };
    }
}
