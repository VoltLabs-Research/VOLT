import { isAccessDeniedError } from '@/shared/errors/core';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { FolderBreadcrumbEntity } from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import useFolderBreadcrumbs from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import useFolderSearchParam from '@/shared/presentation/hooks/use-folder-search-param';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { PromiseToastOptions } from '@/shared/presentation/toast-options';
import { useCallback, useMemo, useState } from 'react';
import { sileo } from 'sileo';

export interface FolderedListingContext {
    folderId: string | null;
};

export interface DeleteFolderConfirmConfig {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
};

export interface FolderedListingBreadcrumb {
    id: string | null;
    title: string;
};

export interface UseFolderedListingOptions<TItem, TFolder extends FolderBreadcrumbEntity, TRow extends { _id: string }> {
    teamId: string | null;
    fetchItems: (params: PaginationParams & FolderedListingContext) => Promise<PaginatedResponse<TItem>>;
    fetchFolders: (folderId: string | null) => Promise<PaginatedResponse<TFolder>>;
    getFolder: (folderId: string) => Promise<TFolder>;
    createEmptyResponse: (params: PaginationParams & FolderedListingContext) => PaginatedResponse<TRow>;
    mapFolderRow: (folder: TFolder) => TRow;
    mapItemRow: (item: TItem) => TRow;
    filterFolders?: (folders: TFolder[], search: string) => TFolder[];
    onFetchErrorTitle: string;
    invalidFolderMessage: string;
    createFolder: (params: { title: string; parentId: string | null }) => Promise<unknown>;
    createFolderToast: PromiseToastOptions<unknown>;
    updateFolder: (params: { folderId: string; title: string }) => Promise<unknown>;
    renameFolderToast: PromiseToastOptions<unknown>;
    deleteFolder: (params: { folderId: string }) => Promise<unknown>;
    deleteFolderToast: PromiseToastOptions<unknown>;
    getDeleteFolderConfirm: (folder: TFolder) => DeleteFolderConfirmConfig;
};

export interface UseFolderedListingReturn<TFolder extends FolderBreadcrumbEntity, TRow extends { _id: string }> {
    breadcrumbs: FolderedListingBreadcrumb[];
    context: FolderedListingContext;
    currentFolder: TFolder | null;
    currentFolderId: string | null;
    fetchData: (params: PaginationParams & FolderedListingContext) => Promise<PaginatedResponse<TRow>>;
    getMoveFolder: (folderId: string) => Promise<TFolder>;
    goToRoot: () => void;
    handleCreateFolder: (title: string) => Promise<void>;
    handleDeleteCurrentFolder: (() => Promise<void>) | null;
    handleDeleteFolder: (folder: TFolder) => Promise<void>;
    handleRenameFolderClose: () => void;
    handleRenameFolderOpen: (folder: TFolder) => void;
    handleRenameFolderSubmit: (title: string) => Promise<void>;
    isInsideFolder: boolean;
    listMoveFolders: (folderId: string | null) => Promise<TFolder[]>;
    navigateToFolder: (folderId: string | null) => void;
    openFolder: (folderId: string) => void;
    renamingFolder: TFolder | null;
};

const useFolderedListing = <
    TItem,
    TFolder extends FolderBreadcrumbEntity,
    TRow extends { _id: string }
>({
    teamId,
    fetchItems,
    fetchFolders,
    getFolder,
    createEmptyResponse,
    mapFolderRow,
    mapItemRow,
    filterFolders,
    onFetchErrorTitle,
    invalidFolderMessage,
    createFolder,
    createFolderToast,
    updateFolder,
    renameFolderToast,
    deleteFolder,
    deleteFolderToast,
    getDeleteFolderConfirm
}: UseFolderedListingOptions<TItem, TFolder, TRow>): UseFolderedListingReturn<TFolder, TRow> => {
    const { currentFolderId, isInsideFolder, openFolder, goToRoot } = useFolderSearchParam();
    const context = useMemo(() => ({ folderId: currentFolderId }), [currentFolderId]);
    const [renamingFolder, setRenamingFolder] = useState<TFolder | null>(null);
    const [folderRefreshKey, setFolderRefreshKey] = useState(0);

    const { breadcrumbs, currentFolder } = useFolderBreadcrumbs<TFolder>({
        currentFolderId,
        getFolder,
        onInvalidFolder: goToRoot,
        refreshKey: folderRefreshKey,
        invalidFolderMessage
    });

    const fetchData = useCallback(async (
        params: PaginationParams & FolderedListingContext
    ): Promise<PaginatedResponse<TRow>> => {
        if (!teamId) {
            return createEmptyResponse(params);
        }

        try {
            const [itemsResponse, foldersResponse] = await Promise.all([
                fetchItems(params),
                params.page === 1 ? fetchFolders(params.folderId ?? null) : Promise.resolve(null)
            ]);

            const nextFolders = filterFolders
                ? filterFolders(foldersResponse?.data ?? [], params.search ?? '')
                : foldersResponse?.data ?? [];
            const folderRows = nextFolders.map(mapFolderRow);
            const itemRows = (itemsResponse.data || []).map(mapItemRow);

            return {
                ...itemsResponse,
                data: params.page === 1
                    ? [...folderRows, ...itemRows]
                    : itemRows
            };
        } catch (error) {
            if (isAccessDeniedError(error)) {
                throw error;
            }

            sileo.error({ title: onFetchErrorTitle });
            return createEmptyResponse(params);
        }
    }, [teamId, createEmptyResponse, fetchFolders, fetchItems, filterFolders, mapFolderRow, mapItemRow, onFetchErrorTitle]);

    const handleCreateFolder = useCallback(async (title: string) => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createFolder({
                title,
                parentId: currentFolderId
            }),
            createFolderToast
        );
    }, [createFolder, createFolderToast, currentFolderId, teamId]);

    const handleRenameFolderOpen = useCallback((folder: TFolder) => {
        setRenamingFolder(folder);
    }, []);

    const handleRenameFolderClose = useCallback(() => {
        setRenamingFolder(null);
    }, []);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        if (!renamingFolder) {
            return;
        }

        await showPromise(
            updateFolder({
                folderId: renamingFolder._id,
                title
            }),
            renameFolderToast
        );

        setFolderRefreshKey((previousValue) => previousValue + 1);
        handleRenameFolderClose();
    }, [handleRenameFolderClose, renameFolderToast, renamingFolder, updateFolder]);

    const handleDeleteFolder = useCallback(async (folder: TFolder) => {
        const confirmConfig = getDeleteFolderConfirm(folder);

        const isConfirmed = await confirm({
            title: confirmConfig.title,
            description: confirmConfig.description,
            confirmText: confirmConfig.confirmText ?? 'Delete Folder',
            cancelText: confirmConfig.cancelText ?? 'Cancel',
            tone: ConfirmActionTone.Danger
        });

        if (!isConfirmed) {
            return;
        }

        await showPromise(deleteFolder({ folderId: folder._id }), deleteFolderToast);
        setFolderRefreshKey((previousValue) => previousValue + 1);

        if (currentFolderId === folder._id) {
            if (folder.parent) {
                openFolder(folder.parent);
                return;
            }

            goToRoot();
        }
    }, [currentFolderId, deleteFolder, deleteFolderToast, getDeleteFolderConfirm, goToRoot, openFolder]);

    const listMoveFolders = useCallback(async (folderId: string | null) => {
        const response = await fetchFolders(folderId);
        return response.data;
    }, [fetchFolders]);

    const getMoveFolder = useCallback((folderId: string) => getFolder(folderId), [getFolder]);

    const navigateToFolder = useCallback((folderId: string | null) => {
        if (folderId) {
            openFolder(folderId);
            return;
        }

        goToRoot();
    }, [goToRoot, openFolder]);

    return {
        breadcrumbs,
        context,
        currentFolder,
        currentFolderId,
        fetchData,
        getMoveFolder,
        goToRoot,
        handleCreateFolder,
        handleDeleteCurrentFolder: currentFolder ? () => handleDeleteFolder(currentFolder) : null,
        handleDeleteFolder,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        isInsideFolder,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    };
};

export default useFolderedListing;
