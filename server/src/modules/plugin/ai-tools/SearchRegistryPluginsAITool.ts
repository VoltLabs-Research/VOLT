import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { SearchRegistryPluginsUseCase } from '@modules/plugin/use-cases/plugin/SearchRegistryPluginsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SearchRegistryPluginsAITool extends AITool {
    readonly name = 'search_registry_plugins';
    readonly description = 'Search the public registry for installable plugins.';
    readonly parameters = z.object({
        q: z.string().optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20)
    });

    constructor(
        protected readonly useCase: SearchRegistryPluginsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            q: params.q,
            page: params.page,
            limit: params.limit
        });
        return { summary: `Found ${result.total} registry plugins.`, data: result.items };
    }
}
