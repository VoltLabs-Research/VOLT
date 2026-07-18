import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListPluginsAITool extends AITool {
    readonly name = 'list_plugins';
    readonly description = 'List analysis plugins installed in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        status: z.string().optional()
    });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.listPlugins({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            status: params.status
        });
        return { summary: `Found ${result.total} plugins.`, data: result.data };
    }
}
