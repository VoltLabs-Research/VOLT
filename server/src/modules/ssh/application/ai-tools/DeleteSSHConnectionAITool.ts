import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { DeleteSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/DeleteSSHConnectionByIdUseCase';

@injectable()
export class DeleteSSHConnectionAITool extends AITool {
    readonly name = 'delete_ssh_connection';
    readonly description = 'Delete an SSH connection.';
    readonly parameters = z.object({ connectionId: z.string(), reason: z.string().optional() });

    constructor(
        @inject(DeleteSSHConnectionByIdUseCase)
        protected readonly useCase: DeleteSSHConnectionByIdUseCase
    ) {
        super();
    }
}
