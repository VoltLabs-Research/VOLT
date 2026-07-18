import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { RegistryInstallPluginUseCase } from '@modules/plugin/use-cases/plugin/RegistryInstallPluginUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class InstallPluginAITool extends AITool {
    readonly name = 'install_plugin';
    readonly description = 'Install a plugin from the registry into the team.';
    readonly parameters = z.object({
        name: z.string(),
        version: z.string().optional()
    });

    constructor(
        protected readonly useCase: RegistryInstallPluginUseCase
    ) {
        super();
    }
}
