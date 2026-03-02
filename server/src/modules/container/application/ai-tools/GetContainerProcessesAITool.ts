import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';

@injectable()
export class GetContainerProcessesAITool extends AITool {
    readonly name = 'get_container_processes';
    readonly description = 'List running processes in a container.';
    readonly parameters = z.object({ containerId: z.string() });

    constructor(
        @inject(GetContainerProcessesUseCase)
        protected readonly useCase: GetContainerProcessesUseCase
    ) {
        super();
    }
}
