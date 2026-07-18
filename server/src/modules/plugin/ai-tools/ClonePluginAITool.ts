import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { ClonePluginUseCase } from '@modules/plugin/use-cases/plugin/ClonePluginUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ClonePluginAITool extends AITool {
    readonly name = 'clone_plugin';
    readonly description = 'Clone an existing plugin into a new draft.';
    readonly parameters = z.object({ pluginId: z.string() });

    constructor(
        protected readonly useCase: ClonePluginUseCase
    ) {
        super();
    }
}
