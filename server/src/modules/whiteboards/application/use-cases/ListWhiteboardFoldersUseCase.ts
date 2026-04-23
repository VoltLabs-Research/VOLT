import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { ListCatalogFoldersUseCase } from '@shared/application/catalog/ListCatalogFoldersUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ListWhiteboardFoldersUseCase extends ListCatalogFoldersUseCase<WhiteboardFolder, WhiteboardFolderProps> {
    constructor(
        
        whiteboardFolderRepository: WhiteboardFolderRepository
    ) {
        super(whiteboardFolderRepository);
    }
}
