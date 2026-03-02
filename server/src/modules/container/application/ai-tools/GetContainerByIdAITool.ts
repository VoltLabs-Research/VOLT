import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';

@injectable()
export class GetContainerByIdAITool extends AITool {
    readonly name = 'get_container_by_id';
    readonly description = 'Get detailed information about a specific container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        @inject(GetContainerByIdUseCase)
        protected readonly useCase: GetContainerByIdUseCase
    ) {
        super();
    }
}
