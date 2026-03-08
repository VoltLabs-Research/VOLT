import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

@injectable()
export class ListContainerFilesAITool extends AITool {
    readonly name = 'list_container_files';
    readonly description = 'List files in a container directory.';
    readonly parameters = z.object({ containerId: z.string(), path: z.string().optional().default('/') });

    constructor(
        @inject(GetContainerFilesUseCase)
        protected readonly useCase: GetContainerFilesUseCase
    ) {
        super();
    }
};
