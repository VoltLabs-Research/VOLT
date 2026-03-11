import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteLatexFolderUseCase extends DeleteCatalogFolderUseCase<LatexFolder, LatexFolderProps, LatexDocument, LatexDocumentProps> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        latexFolderRepository: ILatexFolderRepository,
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        latexDocumentRepository: ILatexDocumentRepository,
        @inject(DeleteLatexDocumentUseCase)
        deleteLatexDocumentUseCase: DeleteLatexDocumentUseCase
    ) {
        super(
            latexFolderRepository,
            latexDocumentRepository,
            async (document, teamId) => {
                const result = await deleteLatexDocumentUseCase.execute({
                    teamId,
                    documentId: document._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'LaTeX folder' }
        );
    }
}
