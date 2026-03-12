import ContainerFolder, { type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapper<ContainerFolder, ContainerFolderProps, CatalogFolderDocument>(
    ContainerFolder,
    ['team', 'createdBy', 'parent']
);
