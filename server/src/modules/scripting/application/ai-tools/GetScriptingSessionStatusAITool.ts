import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { GetScriptingSessionStatusUseCase } from '@modules/scripting/application/use-cases/GetScriptingSessionStatusUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class GetScriptingSessionStatusAITool extends AITool {
    readonly name = 'get_scripting_session_status';
    readonly description = 'Get the Jupyter session status for a scripting notebook.';
    readonly parameters = z.object({ notebookId: z.string() });

    constructor(
        protected readonly useCase: GetScriptingSessionStatusUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            notebookId: params.notebookId
        });
        if (!result.success) throw result.error;
        return { summary: `Session ${result.value.jupyter.ready ? 'ready' : 'not ready'} for notebook ${result.value.notebookId}.`, data: result.value };
    }
}
