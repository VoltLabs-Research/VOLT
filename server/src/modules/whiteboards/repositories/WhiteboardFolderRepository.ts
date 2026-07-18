import { WHITEBOARD_TOKENS } from '@modules/whiteboards/di/WhiteboardTokens';
import type WhiteboardFolder from '@modules/whiteboards/entities/WhiteboardFolder';
import type { WhiteboardFolderProps } from '@modules/whiteboards/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/ports/IWhiteboardFolderRepository';
import whiteboardFolderMapper from '@modules/whiteboards/mappers/WhiteboardFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';


@Singleton(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
export default class WhiteboardFolderRepository
    extends MongooseCatalogFolderRepository<WhiteboardFolder, WhiteboardFolderProps, CatalogFolderDocument>
    implements IWhiteboardFolderRepository {
    constructor() {
        super(CatalogFolderModel, whiteboardFolderMapper, CatalogFolderKind.Whiteboard);
    }
}
