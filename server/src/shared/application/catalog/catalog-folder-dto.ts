import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export interface CatalogFolderDTO {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type DeleteCatalogFolderInputDTO = TeamScopedEntityIdInputDTO<'folderId'>;
