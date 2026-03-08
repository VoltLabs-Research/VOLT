import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import { GetSSHConnectionsByTeamIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionsByTeamIdUseCase';

@injectable()
export class ListSSHConnectionsAITool extends AITool {
    readonly name = 'list_ssh_connections';
    readonly description = 'List all SSH connections configured for the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(GetSSHConnectionsByTeamIdUseCase)
        protected readonly useCase: GetSSHConnectionsByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: 1, limit: 100 });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.data.length} SSH connections.`,
            data: result.value.data.map((connection) => ({
                connectionId: connection._id,
                name: connection.name,
                host: connection.host,
                port: connection.port,
                username: connection.username
            }))
        };
    }
}
