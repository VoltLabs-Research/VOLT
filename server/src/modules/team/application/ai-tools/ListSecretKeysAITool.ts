import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';

@injectable()
export class ListSecretKeysAITool extends AITool {
    readonly name = 'list_secret_keys';
    readonly description = 'List API secret keys for the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(ListSecretKeysByTeamIdUseCase)
        protected readonly useCase: ListSecretKeysByTeamIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ teamId: scope.teamId, page: 1, limit: 100 });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.data.length} secret keys.`, data: result.value.data };
    }
}
