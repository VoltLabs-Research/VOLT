import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';

export interface IWhiteboardFolderRepository extends ICatalogFolderRepository<WhiteboardFolder, WhiteboardFolderProps> {}
