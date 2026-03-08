import { AITool } from '@shared/application/ai/AITool';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/services/AIToolService';

@injectable()
export class ListScriptingNotebooksAITool extends AITool {
    readonly name = 'list_scripting_notebooks';
    readonly description = 'List all Jupyter scripting notebooks in the selected team.';
    readonly parameters = z.object({});

    constructor(
        @inject(ListScriptingNotebooksUseCase)
        protected readonly useCase: ListScriptingNotebooksUseCase
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: 1,
            limit: 100
        });

        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.data.length} notebooks.`,
            data: result.value.data.map((nb) => {
                let trajectories = 0;

                if (Array.isArray(nb.trajectories)) {
                    trajectories = nb.trajectories.length;
                }

                return {
                    notebookId: nb._id,
                    title: nb.title,
                    trajectories,
                    lastOpenedAt: nb.lastOpenedAt ?? null,
                    createdAt: nb.createdAt ?? null
                };
            })
        };
    }
};
