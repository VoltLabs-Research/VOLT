import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class CreateLatexFolderUseCase extends CreateCatalogFolderUseCase<LatexFolder, LatexFolderProps> {
    constructor(
        
        latexFolderRepository: LatexFolderRepository
    ) {
        super(latexFolderRepository, { folderLabel: 'LaTeX folder' });
    }
}
