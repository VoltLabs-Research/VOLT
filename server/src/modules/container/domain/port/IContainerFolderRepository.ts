import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type ContainerFolder from '@modules/container/domain/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/domain/entities/ContainerFolder';

export interface IContainerFolderRepository extends ICatalogFolderRepository<ContainerFolder, ContainerFolderProps> {}
