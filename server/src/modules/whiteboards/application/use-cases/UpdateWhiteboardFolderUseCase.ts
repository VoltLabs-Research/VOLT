import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import { UpdateCatalogFolderUseCase } from '@shared/application/catalog/UpdateCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class UpdateWhiteboardFolderUseCase extends UpdateCatalogFolderUseCase<WhiteboardFolder, WhiteboardFolderProps> {
    constructor(
        whiteboardFolderRepository: WhiteboardFolderRepository
    ) {
        super(whiteboardFolderRepository, { folderLabel: 'Whiteboard folder' });
    }
}
