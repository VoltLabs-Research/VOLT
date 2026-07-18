import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type ContainerFolder from '@modules/container/entities/ContainerFolder';
import type { ContainerFolderProps } from '@modules/container/entities/ContainerFolder';

export interface IContainerFolderRepository extends ICatalogFolderRepository<ContainerFolder, ContainerFolderProps> {}
