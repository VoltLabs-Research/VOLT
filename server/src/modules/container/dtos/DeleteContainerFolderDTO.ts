import type { DeleteCatalogFolderInputDTO } from '@shared/application/catalog/catalog-folder-dto';

export interface DeleteContainerFolderInputDTO extends DeleteCatalogFolderInputDTO {
    userId: string;
}

export type DeleteContainerFolderOutputDTO = null;
