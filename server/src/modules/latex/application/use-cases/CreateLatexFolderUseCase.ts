import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateLatexFolderUseCase extends CreateCatalogFolderUseCase<LatexFolder, LatexFolderProps> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        latexFolderRepository: ILatexFolderRepository
    ) {
        super(latexFolderRepository, { folderLabel: 'LaTeX folder' });
    }
}
