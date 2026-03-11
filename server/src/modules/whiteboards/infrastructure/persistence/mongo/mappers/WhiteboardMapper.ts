import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { WhiteboardDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';

export default createMongoMapper<Whiteboard, WhiteboardProps, WhiteboardDocument>(
    Whiteboard,
    ['team', 'createdBy']
);
