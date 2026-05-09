import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

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

/**
 * Builds the standard folder CRUD endpoint set used by foldered resources.
 */
export const createFolderCrudEndpoints = <
    TListParams,
    TGetParams,
    TCreateParams extends FolderCreateParams,
    TUpdateParams extends FolderUpdateParams,
    TDeleteParams,
    TFolder
>() => ({
    listFolders: paginated<TListParams, PaginatedResponse<TFolder>>('/folders'),
    getFolder: get<TGetParams, TFolder>('/folders/:folderId'),
    createFolder: post<TCreateParams, TFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateFolder: patch<TUpdateParams, TFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<TDeleteParams>('/folders/:folderId')
});
