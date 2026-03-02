import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';

@injectable()
export class DeleteContainerAITool extends AITool {
    readonly name = 'delete_container';
    readonly description = 'Delete a Docker container.';
    readonly parameters = z.object({ containerId: z.string(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor(
        @inject(DeleteContainerUseCase)
        protected readonly useCase: DeleteContainerUseCase
    ) {
        super();
    }
}
