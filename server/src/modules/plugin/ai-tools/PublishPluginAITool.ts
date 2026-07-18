import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import PluginService from '@modules/plugin/services/PluginService';
import { PluginStatus } from '@modules/plugin/models/plugin/PluginModel';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class PublishPluginAITool extends AITool {
    readonly name = 'publish_plugin';
    readonly description = 'Publish a plugin by transitioning it from Draft to Published. The existing workflow is strictly validated first; publishing fails if it is not valid.';
    readonly parameters = z.object({ pluginId: z.string() });

    readonly needsApproval = true;

    #service = new PluginService();

    async execute(params: z.infer<typeof this.parameters>, _scope: AIToolScope) {
        const result = await this.#service.updatePluginById({
            pluginId: params.pluginId,
            status: PluginStatus.Published
        });

        return {
            summary: `Published plugin "${result.modifier?.name ?? result._id}".`,
            data: result
        };
    }
}
