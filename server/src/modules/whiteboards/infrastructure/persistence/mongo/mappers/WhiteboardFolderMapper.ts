import WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapper<WhiteboardFolder, WhiteboardFolderProps, CatalogFolderDocument>(
    WhiteboardFolder,
    ['team', 'createdBy', 'parent']
);
