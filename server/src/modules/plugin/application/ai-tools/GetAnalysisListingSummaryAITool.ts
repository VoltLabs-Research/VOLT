import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginListingService } from '@modules/plugin/infrastructure/services/PluginListingService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class GetAnalysisListingSummaryAITool extends AITool {
    readonly name = 'get_analysis_listing_summary';
    readonly description = 'Get a statistical summary (count, min, max, mean, sum) of numeric columns from plugin listing data.';
    readonly parameters = z.object({
        pluginId: z.string(), exposureId: z.string().optional(), exposureName: z.string().optional(),
        trajectoryId: z.string().optional(), analysisId: z.string().optional()
    });

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository,
        @inject(PluginListingService)
        private readonly pluginListingService: PluginListingService
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const pluginId = params.pluginId;
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');

        const { exposureId, exposureName, trajectoryId, analysisId } = params;
        if (!exposureId && !exposureName) throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Either exposureId or exposureName is required');

        const exported = await this.pluginListingService.exportListingDocuments(pluginId, {
            teamId: scope.teamId, exposureId: exposureId || undefined, exposureName: exposureName || undefined,
            trajectoryId: trajectoryId || undefined, analysisId: analysisId || undefined
        });

        const { data: rows, meta } = exported;
        const columnLabels = meta.columns.map((c: any) => c.label);
        const numericColumns = new Map<string, number[]>();

        for (const row of rows) {
            for (const key of columnLabels) {
                const val = (row as Record<string, unknown>)[key];
                if (typeof val === 'number' && isFinite(val)) {
                    if (!numericColumns.has(key)) numericColumns.set(key, []);
                    numericColumns.get(key)!.push(val);
                }
            }
        }

        const stats: Record<string, { count: number; min: number; max: number; mean: number; sum: number }> = {};
        for (const [key, values] of numericColumns) {
            const sum = values.reduce((a, b) => a + b, 0);
            stats[key] = { count: values.length, min: Math.min(...values), max: Math.max(...values), mean: sum / values.length, sum };
        }

        return { summary: `Summary of ${rows.length} rows across ${Object.keys(stats).length} numeric columns.`, totalRows: rows.length, columns: columnLabels, numericStats: stats };
    }
}
