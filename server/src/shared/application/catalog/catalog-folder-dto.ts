import type { PaginatedTeamScopedInputDTO, TeamScopedEntityIdInputDTO, TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

export interface CatalogFolderDTO {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type CreateCatalogFolderInputDTO = TeamUserScopedInputDTO & {
    title: string;
    parentId?: string | null;
};

export type GetCatalogFolderInputDTO = TeamScopedEntityIdInputDTO<'folderId'>;

export type UpdateCatalogFolderInputDTO = TeamScopedEntityIdInputDTO<'folderId'> & {
    title: string;
};

export type DeleteCatalogFolderInputDTO = TeamScopedEntityIdInputDTO<'folderId'>;

export type ListCatalogFoldersInputDTO = PaginatedTeamScopedInputDTO & {
    parentId?: string | null;
};

export type ListCatalogFoldersOutputDTO = PaginatedResult<CatalogFolderDTO>;
