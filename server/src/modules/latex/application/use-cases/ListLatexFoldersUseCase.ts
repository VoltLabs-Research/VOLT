import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { ListCatalogFoldersUseCase } from '@shared/application/catalog/ListCatalogFoldersUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ListLatexFoldersUseCase extends ListCatalogFoldersUseCase<LatexFolder, LatexFolderProps> {
    constructor(
        latexFolderRepository: LatexFolderRepository
    ) {
        super(latexFolderRepository);
    }
}
