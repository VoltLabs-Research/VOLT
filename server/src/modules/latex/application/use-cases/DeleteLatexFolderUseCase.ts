import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { inject } from 'tsyringe';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
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
