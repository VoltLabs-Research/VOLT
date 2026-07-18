import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/use-cases/CreateScriptingJupyterSessionUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class StartScriptingJupyterSessionAITool extends AITool {
    readonly name = 'start_scripting_jupyter_session';
    readonly description = 'Start a Jupyter session for a scripting notebook.';
    readonly parameters = z.object({
        notebookId: z.string().optional(),
        trajectoryId: z.string().optional(),
        teamClusterId: z.string().optional()
    });

    constructor(
        protected readonly useCase: CreateScriptingJupyterSessionUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            notebookId: params.notebookId,
            trajectoryId: params.trajectoryId,
            teamClusterId: params.teamClusterId
        });
        return { summary: `Jupyter session started for notebook ${value.notebookId}.`, data: value };
    }
}
