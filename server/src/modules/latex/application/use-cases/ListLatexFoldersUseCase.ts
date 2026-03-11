import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { ListCatalogFoldersUseCase } from '@shared/application/catalog/ListCatalogFoldersUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ListLatexFoldersUseCase extends ListCatalogFoldersUseCase<LatexFolder, LatexFolderProps> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        latexFolderRepository: ILatexFolderRepository
    ) {
        super(latexFolderRepository);
    }
}
