import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { GetCatalogFolderUseCase } from '@shared/application/catalog/GetCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class GetLatexFolderUseCase extends GetCatalogFolderUseCase<LatexFolder, LatexFolderProps> {
    constructor(
        
        latexFolderRepository: LatexFolderRepository
    ) {
        super(latexFolderRepository, { folderLabel: 'LaTeX folder' });
    }
}
