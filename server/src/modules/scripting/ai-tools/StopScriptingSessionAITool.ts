import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { DeleteScriptingSessionUseCase } from '@modules/scripting/use-cases/DeleteScriptingSessionUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            notebookId: params.notebookId
        });
        return { summary: `Session ${value.deleted ? 'stopped' : 'not running'} for notebook ${value.notebookId}.`, data: value };
    }
}
