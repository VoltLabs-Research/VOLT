import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

@injectable()
export class UpdateContainerAITool extends AITool {
    readonly name = 'update_container';
    readonly description = 'Update a Docker container.';
    readonly parameters = z.object({
        containerId: z.string(),
        name: z.string().optional(),
        reason: z.string().optional()
    });

    constructor(
        @inject(UpdateContainerUseCase)
        protected readonly useCase: UpdateContainerUseCase
    ) {
        super();
    }
};
