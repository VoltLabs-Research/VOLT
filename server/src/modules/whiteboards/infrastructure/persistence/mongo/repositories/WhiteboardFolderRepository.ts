import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import whiteboardFolderMapper from '@modules/whiteboards/infrastructure/persistence/mongo/mappers/WhiteboardFolderMapper';
import WhiteboardFolderModel, { type WhiteboardFolderDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardFolderModel';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class WhiteboardFolderRepository
    extends MongooseCatalogFolderRepository<WhiteboardFolder, WhiteboardFolderProps, WhiteboardFolderDocument>
    implements IWhiteboardFolderRepository {
    constructor() {
        super(WhiteboardFolderModel, whiteboardFolderMapper);
    }
}
