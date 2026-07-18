import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ClonePluginAITool extends AITool {
    readonly name = 'clone_plugin';
    readonly description = 'Clone an existing plugin into a new draft.';
    readonly parameters = z.object({ pluginId: z.string() });

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.clonePlugin({ pluginId: params.pluginId, teamId: scope.teamId });
    }
}
