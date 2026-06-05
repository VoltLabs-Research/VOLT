import { createEmptyPaginatedResponse } from '@/shared/domain/pagination/create-empty-paginated-response';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
const FOLDER_LIST_LIMIT = 500;
const ROOT_FOLDER_ID = 'root';
import type { FolderBreadcrumbEntity } from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import type { FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { createCrudToastOptions } from '@/shared/presentation/utilities/toast-options';

interface FolderedItemListQueryParams {
    page: number;
    limit: number;
    folderId: string;
    search?: string;
}

interface FolderedFolderListQueryParams {
    page: number;
    limit: number;
    parentId?: string;
}

interface FolderedFolderQueryParams {
    folderId: string;
}

interface CreateFolderedResourceFetchersOptions<TItem, TFolder> {
    listItems: (params: FolderedItemListQueryParams) => Promise<PaginatedResponse<TItem>>;
    listFolders: (params: FolderedFolderListQueryParams) => Promise<PaginatedResponse<TFolder>>;
    getFolder: (params: FolderedFolderQueryParams) => Promise<TFolder>;
    includeSearch?: boolean;
}

interface FolderDeleteConfirmOptions<TFolder extends FolderBreadcrumbEntity> {
    pluralName: string;
    singularName: string;
    getFolderTitle?: (folder: TFolder) => string;
}

const createItemListParams = (
    params: PaginationParams & FolderedListingContext,
    includeSearch: boolean
): FolderedItemListQueryParams => ({
    page: params.page,
    limit: params.limit,
    folderId: params.folderId ?? ROOT_FOLDER_ID,
    ...(includeSearch && params.search ? { search: params.search } : {})
});

const createFolderListParams = (folderId: string | null): FolderedFolderListQueryParams => ({
    page: 1,
    limit: FOLDER_LIST_LIMIT,
    ...(folderId ? { parentId: folderId } : {})
});

const createFolderParams = (folderId: string): FolderedFolderQueryParams => ({ folderId });

export const FOLDER_RESOURCE_TOASTS = {
    create: createCrudToastOptions({ action: 'Creating', subject: 'Folder' }),
    rename: createCrudToastOptions({ action: 'Renaming', subject: 'Folder' }),
    delete: createCrudToastOptions({ action: 'Deleting', subject: 'Folder' })
};

export const createFolderedResourceFetchers = <TItem, TFolder>({
    listItems,
    listFolders,
    getFolder,
    includeSearch = true
}: CreateFolderedResourceFetchersOptions<TItem, TFolder>) => ({
    fetchItems: (params: PaginationParams & FolderedListingContext) => listItems(createItemListParams(params, includeSearch)),
    fetchFolders: (folderId: string | null) => listFolders(createFolderListParams(folderId)),
    getFolder: (folderId: string) => getFolder(createFolderParams(folderId)),
    createEmptyResponse: createEmptyPaginatedResponse
});

export const createFolderResourceDeleteConfirm = <TFolder extends FolderBreadcrumbEntity>({
    pluralName,
    singularName,
    getFolderTitle = (folder) => folder.title
}: FolderDeleteConfirmOptions<TFolder>) => (folder: TFolder) => ({
    title: `Delete "${getFolderTitle(folder)}"? Nested folders and all ${pluralName} inside them will be deleted recursively.`,
    description: `This permanently deletes the folder tree and every ${singularName} contained in it.`
});
