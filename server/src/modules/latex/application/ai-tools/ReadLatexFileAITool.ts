import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';

@injectable()
export class ReadLatexFileAITool extends AITool {
    readonly name = 'read_latex_file';
    readonly description = 'Read the content of a specific LaTeX file.';
    readonly parameters = z.object({
        documentId: z.string(),
        fileId: z.string()
    });

    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
            scope.teamId,
            params.documentId
        );
        if (!document) throw new Error('LaTeX document not found.');

        const file = await this.latexFileRepository.findByDocumentAndFileId(
            params.documentId,
            params.fileId
        );
        if (!file) throw new Error('LaTeX file not found.');

        return {
            summary: `Read file "${file.props.name}".`,
            fileId: file._id,
            name: file.props.name,
            path: file.props.path,
            content: file.props.content,
            isEntrypoint: file.props.isEntrypoint
        };
    }
}
