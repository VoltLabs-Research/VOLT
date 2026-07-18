import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetPluginByIdAITool extends AITool {
    readonly name = 'get_plugin';
    readonly description = 'Get detailed metadata about a specific plugin.';
    readonly parameters = z.object({ pluginId: z.string() });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.#service.getPluginById({ pluginId: params.pluginId });
        return { summary: `Plugin "${result.modifier?.name ?? result._id}" (${result.status}).`, data: result };
    }
}
