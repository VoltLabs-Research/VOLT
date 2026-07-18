import type { ILatexFolderRepository } from '@modules/latex/ports/ILatexFolderRepository';
import { inject } from 'tsyringe';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { DeleteLatexDocumentUseCase } from '@modules/latex/use-cases/DeleteLatexDocumentUseCase';
import type { LatexDocumentProps } from '@modules/latex/entities/LatexDocument';
import LatexDocument from '@modules/latex/entities/LatexDocument';
import type LatexFolder from '@modules/latex/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/entities/LatexFolder';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class DeleteLatexFolderUseCase extends DeleteCatalogFolderUseCase<LatexFolder, LatexFolderProps, LatexDocument, LatexDocumentProps> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository) latexFolderRepository: ILatexFolderRepository,
        @inject(LATEX_TOKENS.LatexDocumentRepository) latexDocumentRepository: ILatexDocumentRepository,
        deleteLatexDocumentUseCase: DeleteLatexDocumentUseCase
    ) {
        super(
            latexFolderRepository,
            latexDocumentRepository,
            async (document, teamId) => {
                await deleteLatexDocumentUseCase.execute({
                    teamId,
                    documentId: document._id
                });
            },
            { folderLabel: 'LaTeX folder' }
        );
    }
}
