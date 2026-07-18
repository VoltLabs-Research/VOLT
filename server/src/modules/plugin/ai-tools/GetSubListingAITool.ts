import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetSubListingAITool extends AITool {
    readonly name = 'get_sub_listing';
    readonly description = 'Fetch the rows of a nested sub-listing within a plugin exposure for a specific trajectory timestep (paginated). Use when a result row drills down into a secondary table.';
    readonly parameters = z.object({
        analysisId: z.string(),
        exposureId: z.string(),
        timestep: z.number(),
        subListingName: z.string(),
        page: z.number().optional(),
        limit: z.number().optional()
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.getSubListing({
            analysisId: params.analysisId,
            exposureId: params.exposureId,
            timestep: params.timestep,
            subListingName: params.subListingName,
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit
        });

        const value = result;
        return {
            summary: `Sub-listing "${value.subListingName}" returned ${value.rows.length} of ${value.total} rows (page ${value.page}/${value.totalPages || 1}).`,
            data: value
        };
    }
}
