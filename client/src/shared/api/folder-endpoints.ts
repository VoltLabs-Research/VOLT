import { del, get, paginated, patch, post } from '@/app/core/http/utils/create-service';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';

export interface FolderCreateParams {
    title: string;
    parentId?: string | null;
}

export interface FolderUpdateParams {
    folderId: string;
    title: string;
}

export interface FolderDeleteParams {
    folderId: string;
}

export interface FolderGetParams {
    folderId: string;
}

export interface FolderListParams {
    page?: number;
    limit?: number;
    parentId?: string;
}

export const createFolderCrudEndpoints = <
    TListParams,
    TGetParams,
    TCreateParams extends FolderCreateParams,
    TUpdateParams extends FolderUpdateParams,
    TDeleteParams,
    TFolder
>(collectionPath: string) => ({
    listFolders: paginated<TListParams, PaginatedResponse<TFolder>>(collectionPath),
    getFolder: get<TGetParams, TFolder>(`${collectionPath}/:folderId`),
    createFolder: post<TCreateParams, TFolder>(collectionPath, {
        body: ({ title, parentId }) => ({
            title,
            parentId
        })
    }),
    updateFolder: patch<TUpdateParams, TFolder>(`${collectionPath}/:folderId`, {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<TDeleteParams>(`${collectionPath}/:folderId`)
});
