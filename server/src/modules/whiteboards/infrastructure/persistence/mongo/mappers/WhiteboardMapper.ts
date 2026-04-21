import { createWhiteboard } from '@modules/whiteboards/domain/entities/Whiteboard';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';

export default createMongoMapperFromFactory<Whiteboard, WhiteboardProps, WhiteboardDocument>(
    createWhiteboard,
    ['team', 'createdBy', 'lastEditedBy', 'folder']
);
