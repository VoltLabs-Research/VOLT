import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export class UpdatePluginAITool extends AITool {
    readonly name = 'update_plugin';
    readonly description = 'Update a plugin.';
    readonly parameters = z.object({ pluginId: z.string(), name: z.string().optional(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepo: IPluginRepository
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const { pluginId, name } = params;
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');

        const entity = plugin as any;
        if (name !== undefined) entity.props.modifier = { ...entity.props.modifier, name };
        
        await this.pluginRepo.update(entity);
        return { summary: `Plugin "${pluginId}" updated.`, result: { pluginId } };
    }
}
