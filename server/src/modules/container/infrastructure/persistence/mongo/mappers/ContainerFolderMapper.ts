import { createContainerFolder, type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

export default createMongoMapperFromFactory<ContainerFolder, ContainerFolderProps, CatalogFolderDocument>(
    createContainerFolder,
    ['team', 'createdBy', 'parent']
);
