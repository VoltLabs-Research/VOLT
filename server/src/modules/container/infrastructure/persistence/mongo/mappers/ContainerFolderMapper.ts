import ContainerFolder, { type ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { ContainerFolderDocument } from '@modules/container/infrastructure/persistence/mongo/models/ContainerFolderModel';

export default createMongoMapper<ContainerFolder, ContainerFolderProps, ContainerFolderDocument>(
    ContainerFolder,
    ['team', 'createdBy', 'parent']
);
