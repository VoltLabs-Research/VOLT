import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';

@injectable()
export class DeletePluginAITool extends AITool {
    readonly name = 'delete_plugin';
    readonly description = 'Delete a plugin.';
    readonly parameters = z.object({ pluginId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor(
        @inject(DeletePluginByIdUseCase)
        protected readonly useCase: DeletePluginByIdUseCase
    ) {
        super();
    }
}
