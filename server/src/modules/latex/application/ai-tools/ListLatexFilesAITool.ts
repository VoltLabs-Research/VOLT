import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListLatexFilesAITool extends AITool {
    readonly name = 'list_latex_files';
    readonly description = 'List the source files inside a LaTeX document.';
    readonly parameters = z.object({ documentId: z.string() });

    constructor(
        protected readonly useCase: ListLatexFilesUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.length} LaTeX files.`, data: result.value };
    }
}
