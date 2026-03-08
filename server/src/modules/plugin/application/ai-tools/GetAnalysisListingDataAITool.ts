import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import type { IPluginListingService } from '@modules/plugin/domain/port/IPluginListingService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class GetAnalysisListingDataAITool extends AITool {
    readonly name = 'get_analysis_listing_data';
    readonly description = 'Read tabular plugin analysis results for a specific plugin exposure. Requires pluginId and either exposureId or exposureName.';
    readonly parameters = z.object({
        pluginId: z.string(), exposureId: z.string().optional(), exposureName: z.string().optional(),
        trajectoryId: z.string().optional(), analysisId: z.string().optional(),
        page: z.number().optional().default(1), limit: z.number().optional().default(50)
    });

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginListingService)
        private readonly pluginListingService: IPluginListingService
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const pluginId = params.pluginId;
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');

        const { exposureId, exposureName, trajectoryId, analysisId, page, limit } = params;
        if (!exposureId && !exposureName) throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Either exposureId or exposureName is required');

        const result = await this.pluginListingService.getListingDocuments(pluginId, {
            teamId: scope.teamId, exposureId: exposureId || undefined, exposureName: exposureName || undefined,
            trajectoryId: trajectoryId || undefined, analysisId: analysisId || undefined,
            page, limit: Math.min(limit, 200)
        });
        return { summary: `Found ${result.total} listing rows.`, data: result.data, total: result.total, page: result.page, totalPages: result.totalPages };
    }
}
