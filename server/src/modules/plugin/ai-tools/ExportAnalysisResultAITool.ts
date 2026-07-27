import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { ExportType } from '@shared/domain/port/persistence';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ExportAnalysisResultAITool extends AITool {
    readonly name = 'export_analysis_result';
    readonly description = 'Produce a downloadable export (JSON or CSV) of all listing rows for an analysis. Returns export metadata (filename, format, headers); it does not stream the file contents into the chat.';
    readonly parameters = z.object({
        analysisId: z.string(),
        format: z.nativeEnum(ExportType).optional(),
        includeConfig: z.boolean().optional(),
        selectedListingIds: z.array(z.string()).optional(),
        selectedSubListingIds: z.array(z.string()).optional(),
        sortAsc: z.boolean().optional()
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.exportListingRowsByAnalysisId({
            analysisId: params.analysisId,
            teamId: scope.teamId,
            format: params.format,
            includeConfig: params.includeConfig,
            selectedListingIds: params.selectedListingIds,
            selectedSubListingIds: params.selectedSubListingIds,
            sortAsc: params.sortAsc
        });

        const { headers } = result;
        const filename = headers['Content-Disposition'] ?? headers['content-disposition'];
        const contentType = headers['Content-Type'] ?? headers['content-type'];

        return {
            summary: `Prepared an export for analysis ${params.analysisId} (${params.format ?? ExportType.Json}). Download it from the analysis export endpoint.`,
            data: {
                analysisId: params.analysisId,
                format: params.format ?? ExportType.Json,
                filename,
                contentType,
                note: 'Export prepared. Binary contents are not included in chat; use the download endpoint to retrieve the file.'
            }
        };
    }
}
