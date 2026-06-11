import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            notebookId: params.notebookId,
            trajectoryId: params.trajectoryId,
            teamClusterId: params.teamClusterId
        });
        if (!result.success) throw result.error;
        return { summary: `Jupyter session started for notebook ${result.value.notebookId}.`, data: result.value };
    }
}
