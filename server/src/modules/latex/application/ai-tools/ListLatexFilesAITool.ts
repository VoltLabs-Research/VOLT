import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { LatexFileDTO } from '@modules/latex/application/dtos/LatexFileDTO';

@injectable()
export class ListLatexFilesAITool extends AITool {
    readonly name = 'list_latex_files';
    readonly description = 'List all files in a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string()
    });

    constructor(
        @inject(ListLatexFilesUseCase)
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

        return {
            summary: `Found ${result.value.length} files in the document.`,
            data: result.value.map((file: LatexFileDTO) => ({
                fileId: file._id,
                name: file.name,
                path: file.path,
                isEntrypoint: file.isEntrypoint,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt
            }))
        };
    }
}
