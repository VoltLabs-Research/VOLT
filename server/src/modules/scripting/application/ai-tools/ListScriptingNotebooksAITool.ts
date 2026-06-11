import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListScriptingNotebooksAITool extends AITool {
    readonly name = 'list_scripting_notebooks';
    readonly description = 'List scripting Jupyter notebooks in the team.';
    readonly parameters = z.object({
        trajectoryId: z.string().optional(),
        scope: z.nativeEnum(ScriptingNotebookScope).optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(500)
    });

    constructor(
        protected readonly useCase: ListScriptingNotebooksUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId,
            scope: params.scope,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} scripting notebooks.`, data: result.value.data };
    }
}
