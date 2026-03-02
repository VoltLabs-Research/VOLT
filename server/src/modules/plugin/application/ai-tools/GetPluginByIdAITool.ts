import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';

@injectable()
export class GetPluginByIdAITool extends AITool {
    readonly name = 'get_plugin_by_id';
    readonly description = 'Get detailed information about a specific plugin by its ID.';
    readonly parameters = z.object({ pluginId: z.string() });

    constructor(
        @inject(GetPluginByIdUseCase)
        protected readonly useCase: GetPluginByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ pluginId: params.pluginId });
        if (!result.success) throw result.error;
        const plugin = result.value as any;
        return {
            pluginId: plugin._id || params.pluginId,
            name: plugin.modifier?.name || params.pluginId,
            status: plugin.status, validated: plugin.validated,
            exposures: Array.isArray(plugin.exposures) ? plugin.exposures.map((e: any) => ({
                exposureId: e._id, name: e.name,
                hasListing: Boolean(e.listing && Object.keys(e.listing).length > 0),
                listingColumns: e.listing ? Object.values(e.listing) : [],
                canvas: e.canvas ?? false, raster: e.raster ?? false
            })) : []
        };
    }
}
