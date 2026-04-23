import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { CreateCatalogFolderUseCase } from '@shared/application/catalog/CreateCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class CreateWhiteboardFolderUseCase extends CreateCatalogFolderUseCase<WhiteboardFolder, WhiteboardFolderProps> {
    constructor(
        
        whiteboardFolderRepository: WhiteboardFolderRepository
    ) {
        super(whiteboardFolderRepository, { folderLabel: 'Whiteboard folder' });
    }
}
