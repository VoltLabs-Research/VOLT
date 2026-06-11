import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListPluginListingDocumentsAITool extends AITool {
    readonly name = 'list_plugin_listing_documents';
    readonly description = 'List a plugin exposure\'s result rows as tabular metadata.';
    readonly parameters = z.object({
        pluginId: z.string(),
        analysisId: z.string().optional(),
        trajectoryId: z.string().optional(),
        exposureId: z.string().optional(),
        exposureName: z.string().optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        sortAsc: z.boolean().optional()
    });

    constructor(
        protected readonly useCase: GetPluginListingDocumentsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            pluginId: params.pluginId,
            analysisId: params.analysisId,
            trajectoryId: params.trajectoryId,
            exposureId: params.exposureId,
            exposureName: params.exposureName,
            page: params.page,
            limit: params.limit,
            sortAsc: params.sortAsc
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} listing rows.`, data: result.value.data };
    }
}
