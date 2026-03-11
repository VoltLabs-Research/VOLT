import WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardFolderModel';

export default createMongoMapper<WhiteboardFolder, WhiteboardFolderProps, WhiteboardFolderDocument>(
    WhiteboardFolder,
    ['team', 'createdBy', 'parent']
);
