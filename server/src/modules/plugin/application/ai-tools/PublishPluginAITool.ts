import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class PublishPluginAITool extends AITool {
    readonly name = 'publish_plugin';
    readonly description = 'Publish a plugin by transitioning it from Draft to Published. The existing workflow is strictly validated first; publishing fails if it is not valid.';
    readonly parameters = z.object({ pluginId: z.string() });

    readonly needsApproval = true;

    constructor(
        protected readonly useCase: UpdatePluginByIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.useCase.execute({
            pluginId: params.pluginId,
            status: PluginStatus.Published
        });
        if (!result.success) throw result.error;

        return {
            summary: `Published plugin "${result.value.modifier?.name ?? result.value._id}".`,
            data: result.value
        };
    }
}
