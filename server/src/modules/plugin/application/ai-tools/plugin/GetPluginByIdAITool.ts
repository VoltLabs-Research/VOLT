import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';

import { AITool } from '@shared/application/ai/AITool';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

import type { AIToolScope } from '@modules/ai/services/AIToolService';

import type { GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';

interface PluginExposureSummary {
    _id: string;
    name: string;
    hasListing?: boolean;
    canvas?: boolean;
    raster?: boolean;
};

interface PluginExposureResponse {
    exposureId: string;
    name: string;
    hasListing: boolean;
    canvas: boolean;
    raster: boolean;
};

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
        const plugin: GetPluginByIdOutputDTO = result.value;

        let exposures: PluginExposureResponse[] = [];
        if (Array.isArray(plugin.exposures)) {
            exposures = plugin.exposures.map((exposure: PluginExposureSummary) => ({
                exposureId: exposure._id,
                name: exposure.name,
                hasListing: Boolean(exposure.hasListing),
                canvas: exposure.canvas ?? false,
                raster: exposure.raster ?? false
            }));
        }

        return {
            pluginId: plugin._id || params.pluginId,
            name: plugin.modifier?.name || params.pluginId,
            status: plugin.status,
            validated: plugin.validated,
            exposures
        };
    }
};
