import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { CreateSSHConnectionUseCase } from '@modules/ssh/application/use-cases/CreateSSHConnectionUseCase';

@injectable()
export class CreateSSHConnectionAITool extends AITool {
    readonly name = 'create_ssh_connection';
    readonly description = 'Create a new SSH connection.';
    readonly parameters = z.object({
        name: z.string(), host: z.string(), username: z.string(),
        port: z.number().optional().default(22),
        password: z.string().optional(), privateKey: z.string().optional(),
        reason: z.string().optional()
    });

    constructor(
        @inject(CreateSSHConnectionUseCase)
        protected readonly useCase: CreateSSHConnectionUseCase
    ) {
        super();
    }
}
