import { del, get, paginated, patch, post } from '@/app/core/http/utils/create-service';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Endpoint } from '@volt/contracts/shared/routing';

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

interface FolderCrudEndpoints {
    list: Endpoint<never, unknown>;
    get: Endpoint<never, unknown>;
    create: Endpoint<never, unknown>;
    update: Endpoint<never, unknown>;
    remove: Endpoint<never, unknown>;
}

export const createFolderCrudEndpoints = <
    TListParams,
    TGetParams,
    TCreateParams extends FolderCreateParams,
    TUpdateParams extends FolderUpdateParams,
    TDeleteParams,
    TFolder
>(
    folderRoutes: FolderCrudEndpoints,
    pathOf: (endpoint: Endpoint<never, unknown>) => string
) => ({
    listFolders: paginated<TListParams, PaginatedResponse<TFolder>>(pathOf(folderRoutes.list)),
    getFolder: get<TGetParams, TFolder>(pathOf(folderRoutes.get)),
    createFolder: post<TCreateParams, TFolder>(pathOf(folderRoutes.create), {
        body: ({ title, parentId }) => ({
            title,
            parentId
        })
    }),
    updateFolder: patch<TUpdateParams, TFolder>(pathOf(folderRoutes.update), {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<TDeleteParams>(pathOf(folderRoutes.remove))
});
