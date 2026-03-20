import type { DeleteCatalogFolderInputDTO } from '@shared/application/catalog/catalog-folder-dto';

export interface DeleteWhiteboardFolderInputDTO extends DeleteCatalogFolderInputDTO {
    userId: string;
};

export type DeleteWhiteboardFolderOutputDTO = null;
