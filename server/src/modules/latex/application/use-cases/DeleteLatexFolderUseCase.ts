import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DeleteLatexFolderUseCase extends DeleteCatalogFolderUseCase<LatexFolder, LatexFolderProps, LatexDocumentProps> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        latexFolderRepository: ILatexFolderRepository,
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        latexDocumentRepository: ILatexDocumentRepository
    ) {
        super(latexFolderRepository, latexDocumentRepository, { folderLabel: 'LaTeX folder' });
    }
}
