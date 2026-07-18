import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class SearchRegistryPluginsAITool extends AITool {
    readonly name = 'search_registry_plugins';
    readonly description = 'Search the public registry for installable plugins.';
    readonly parameters = z.object({
        q: z.string().optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20)
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.searchRegistry({
            teamId: scope.teamId,
            q: params.q,
            page: params.page,
            limit: params.limit
        });
        return { summary: `Found ${result.total} registry plugins.`, data: result.items };
    }
}
