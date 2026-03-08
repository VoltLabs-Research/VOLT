import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';
import type { ListedPluginDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';

interface PluginExposureSummary {
    _id: string;
    name: string;
    hasListing?: boolean;
}

@injectable()
export class ListPluginsAITool extends AITool {
    readonly name = 'list_plugins';
    readonly description = 'List plugins available in the selected team. Returns exposures with exposureId and name.';
    readonly parameters = z.object({});

    constructor(
        @inject(ListPluginsUseCase)
        protected readonly useCase: ListPluginsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, userId: scope.userId, page: 1, limit: 500 });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.data.length} plugins.`,
            data: result.value.data.map((plugin: ListedPluginDTO) => ({
                pluginId: plugin._id,
                name: plugin.modifier?.name || plugin._id,
                status: plugin.status,
                validated: plugin.validated,
                exposures: Array.isArray(plugin.exposures) ? plugin.exposures.map((exposure: PluginExposureSummary) => ({
                    exposureId: exposure._id,
                    name: exposure.name,
                    hasListing: Boolean(exposure.hasListing)
                })) : []
            }))
        };
    }
}
