import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { DeleteScriptingSessionUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingSessionUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class StopScriptingSessionAITool extends AITool {
    readonly name = 'stop_scripting_session';
    readonly description = 'Stop the Jupyter session for a scripting notebook.';
    readonly parameters = z.object({ notebookId: z.string() });

    constructor(
        protected readonly useCase: DeleteScriptingSessionUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            notebookId: params.notebookId
        });
        if (!result.success) throw result.error;
        return { summary: `Session ${result.value.deleted ? 'stopped' : 'not running'} for notebook ${result.value.notebookId}.`, data: result.value };
    }
}
