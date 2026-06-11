import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { RegistryInstallPluginUseCase } from '@modules/plugin/application/use-cases/plugin/RegistryInstallPluginUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
