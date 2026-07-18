import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeletePluginByIdUseCase } from '@modules/plugin/use-cases/plugin/DeletePluginByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UninstallPluginAITool extends AITool {
    readonly name = 'uninstall_plugin';
    readonly description = 'Remove a plugin from the team.';
    readonly parameters = z.object({ pluginId: z.string(), reason: z.string().optional() });

    constructor(
        protected readonly useCase: DeletePluginByIdUseCase
    ) {
        super();
    }
}
