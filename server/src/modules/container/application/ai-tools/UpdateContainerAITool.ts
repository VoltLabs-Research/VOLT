import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';

@injectable()
export class UpdateContainerAITool extends AITool {
    readonly name = 'update_container';
    readonly description = 'Update a Docker container.';
    readonly parameters = z.object({ containerId: z.string(), name: z.string().optional(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor(
        @inject(UpdateContainerUseCase)
        protected readonly useCase: UpdateContainerUseCase
    ) {
        super();
    }
}
