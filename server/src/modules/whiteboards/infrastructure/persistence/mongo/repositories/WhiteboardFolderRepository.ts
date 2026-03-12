import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import whiteboardFolderMapper from '@modules/whiteboards/infrastructure/persistence/mongo/mappers/WhiteboardFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { injectable } from 'tsyringe';

@injectable()
export default class WhiteboardFolderRepository
    extends MongooseCatalogFolderRepository<WhiteboardFolder, WhiteboardFolderProps, CatalogFolderDocument>
    implements IWhiteboardFolderRepository {
    constructor() {
        super(CatalogFolderModel, whiteboardFolderMapper, CatalogFolderKind.Whiteboard);
    }
}
