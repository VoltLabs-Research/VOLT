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

export interface FolderedMoveTargetSource {
    _id: string;
    folder?: string | null;
    title?: string | null;
    name?: string | null;
}

export interface FolderedMoveTarget {
    _id: string;
    folder: string | null;
    title?: string | null;
    name?: string | null;
}

export const pickFolderedMoveTarget = (item: FolderedMoveTargetSource): FolderedMoveTarget => ({
    _id: item._id,
    folder: item.folder ?? null,
    title: item.title,
    name: item.name
});

export interface FolderedListingResourceCopy {
    itemLabel: string;
    newFolderTitle: string;
    newFolderDescription: string;
    renameFolderTitle: string;
    renameFolderDescription: string;
}

export interface FolderedListingModalIds {
    newFolder: string;
    renameFolder: string;
    move: string;
}

interface CreateFolderedListingResourceOptions<TItem, TFolder> extends CreateFolderedResourceFetchersOptions<TItem, TFolder> {
    subject: string;
    singularName: string;
    pluralName: string;
    permissionPrefix: string;
    // Sentence-case label used inside folder copy ("This {folderLabel} folder…"); defaults to singularName.
    folderLabel?: string;
    // Title-case label for folder modal titles ("New {folderTitle} Folder"); defaults to subject.
    folderTitle?: string;
    // Label used in list copy ("Failed to fetch {pluralLabel}"); defaults to pluralName.
    pluralLabel?: string;
    // Modal id segments; default to singularName.
    folderModalNoun?: string;
    moveModalNoun?: string;
}

export const createFolderedListingResource = <TItem, TFolder extends FolderBreadcrumbEntity>({
    subject,
    singularName,
    pluralName,
    permissionPrefix,
    folderLabel = singularName,
    folderTitle = subject,
    pluralLabel = pluralName,
    folderModalNoun = singularName,
    moveModalNoun = singularName,
    ...fetcherOptions
}: CreateFolderedListingResourceOptions<TItem, TFolder>) => {
    const modalIds: FolderedListingModalIds = {
        newFolder: `new-${folderModalNoun}-folder-modal`,
        renameFolder: `rename-${folderModalNoun}-folder-modal`,
        move: `move-${moveModalNoun}-modal`
    };

    const toasts = {
        create: createCrudToastOptions({ action: 'Creating', subject }),
        rename: createCrudToastOptions({ action: 'Renaming', subject }),
        delete: createCrudToastOptions({ action: 'Deleting', subject }),
        move: createCrudToastOptions({ action: 'Moving', subject })
    };

    const copy: FolderedListingResourceCopy = {
        itemLabel: subject,
        newFolderTitle: `New ${folderTitle} Folder`,
        newFolderDescription: `Create a folder in the current ${pluralLabel} location.`,
        renameFolderTitle: `Rename ${folderTitle} Folder`,
        renameFolderDescription: `Update the current ${folderLabel} folder name.`
    };

    const listingOptions = {
        ...createFolderedResourceFetchers<TItem, TFolder>(fetcherOptions),
        onFetchErrorTitle: `Failed to fetch ${pluralLabel}`,
        invalidFolderMessage: `This ${folderLabel} folder no longer exists. Showing Root instead.`,
        createFolderToast: FOLDER_RESOURCE_TOASTS.create,
        renameFolderToast: FOLDER_RESOURCE_TOASTS.rename,
        deleteFolderToast: FOLDER_RESOURCE_TOASTS.delete,
        getDeleteFolderConfirm: createFolderResourceDeleteConfirm<TFolder>({ pluralName, singularName }),
        renameFolderModalId: modalIds.renameFolder,
        moveModalId: modalIds.move,
        moveToast: toasts.move,
        folderPermissions: {
            rename: `${permissionPrefix}:update`,
            delete: `${permissionPrefix}:delete`
        },
        getMoveTarget: pickFolderedMoveTarget,
        activationDistance: 6
    };

    return { subject, modalIds, toasts, copy, listingOptions };
};

export type FolderedListingResource = Pick<
    ReturnType<typeof createFolderedListingResource>,
    'modalIds' | 'copy'
>;
