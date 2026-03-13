import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { UpdateSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/UpdateSSHConnectionByIdUseCase';

@injectable()
export class UpdateSSHConnectionAITool extends AITool {
    readonly name = 'update_ssh_connection';
    readonly description = 'Update an SSH connection.';
    readonly parameters = z.object({
        connectionId: z.string(), name: z.string().optional(), host: z.string().optional(),
        port: z.number().optional(), username: z.string().optional(), reason: z.string().optional()
    });

    constructor(
        @inject(UpdateSSHConnectionByIdUseCase)
        protected readonly useCase: UpdateSSHConnectionByIdUseCase
    ) {
        super();
    }
}
