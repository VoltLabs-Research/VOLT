import { createWhiteboardFolder } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapperFromFactory<WhiteboardFolder, WhiteboardFolderProps, CatalogFolderDocument>(
    createWhiteboardFolder,
    ['team', 'createdBy', 'parent']
);
