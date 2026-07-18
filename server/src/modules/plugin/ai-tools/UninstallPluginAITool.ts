import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class UninstallPluginAITool extends AITool {
    readonly name = 'uninstall_plugin';
    readonly description = 'Remove a plugin from the team.';
    readonly parameters = z.object({ pluginId: z.string(), reason: z.string().optional() });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        return this.#service.deletePluginById({ pluginId: params.pluginId });
    }
}
