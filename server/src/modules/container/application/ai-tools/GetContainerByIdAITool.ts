import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

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
};
