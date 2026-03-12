import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { LatexDocumentDTO } from '@modules/latex/application/dtos/LatexDocumentDTO';

@injectable()
export class ListLatexDocumentsAITool extends AITool {
    readonly name = 'list_latex_documents';
    readonly description = 'List all LaTeX documents in the current team.';
    readonly parameters = z.object({
        search: z.string().optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(100)
    });

    constructor(
        @inject(ListLatexDocumentsUseCase)
        protected readonly useCase: ListLatexDocumentsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });
        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.data.length} LaTeX documents.`,
            data: result.value.data.map((doc: LatexDocumentDTO) => ({
                documentId: doc._id,
                title: doc.title,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt
            })),
            total: result.value.total
        };
    }
}
