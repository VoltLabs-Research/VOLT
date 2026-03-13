import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';

import { AITool } from '@shared/application/ai/AITool';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';

@injectable()
export class DeletePluginAITool extends AITool {
    readonly name = 'delete_plugin';
    readonly description = 'Delete a plugin.';
    readonly parameters = z.object({ pluginId: z.string(), reason: z.string().optional() });

    constructor(
        @inject(DeletePluginByIdUseCase)
        protected readonly useCase: DeletePluginByIdUseCase
    ) {
        super();
    }
};
