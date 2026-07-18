import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
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

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.installRegistry({ teamId: scope.teamId, name: params.name, version: params.version });
    }
}
