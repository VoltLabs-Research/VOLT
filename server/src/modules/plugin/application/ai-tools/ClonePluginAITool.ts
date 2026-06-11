import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { ClonePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ClonePluginUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
