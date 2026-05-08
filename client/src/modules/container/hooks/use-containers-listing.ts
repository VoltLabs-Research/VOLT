import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { ContainerFolder } from '@/modules/container/api/entities/container-folder';
import {
    containerFolderQuery,
    containerFoldersQuery,
    containerQuery,
    useCreateContainerFolderMutation,
    useDeleteContainerFolderMutation,
    useMoveContainerMutation,
    useUpdateContainerFolderMutation
} from '@/modules/container/hooks/queries';
import {
    createContainerFolderRow,
    createContainerItemRow,
    getContainerListingDraggableId,
    getContainerListingDroppableId,
    isContainerFolderRow,
    isContainerItemRow,
    type ContainerListingRow
} from '@/modules/container/utilities/listing';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import useFolderedListingDragAndDropMove from '@/shared/presentation/hooks/use-foldered-listing-drag-and-drop-move';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useFolderedListingMoveModal from '@/shared/presentation/hooks/use-foldered-listing-move-modal';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import useRenameFolderModal from '@/shared/presentation/hooks/use-rename-folder-modal';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT, ROOT_FOLDER_ID } from '@/shared/presentation/constants/foldered-listing';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createEmptyPaginatedResponse, type PaginatedResponse } from '@/shared/domain/pagination';
import { sileo } from 'sileo';
import { Box, FolderInput, FolderOpen, Pencil, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { RiTerminalLine } from 'react-icons/ri';
import { ContainerAction } from '../api/dtos/update-container';
import { useNavigate } from 'react-router-dom';
export const NEW_CONTAINER_FOLDER_MODAL_ID = 'new-container-folder-modal';
export const RENAME_CONTAINER_FOLDER_MODAL_ID = 'rename-container-folder-modal';
export const MOVE_CONTAINER_MODAL_ID = 'move-container-modal';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_CONTAINER_EVENTS.CREATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.UPDATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.DELETED, queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

interface ContainerMoveTarget {
    _id: string;
    name: string;
    folder: string | null;
}

const getContainerMoveTarget = (container: ContainerEntity): ContainerMoveTarget => ({
    _id: container._id,
    name: container.name,
    folder: container.folder
});

const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder' });
const MOVE_CONTAINER_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Container' });
const START_CONTAINER_TOAST = createCrudToastOptions({ action: 'Starting', subject: 'Container' });
const STOP_CONTAINER_TOAST = createCrudToastOptions({ action: 'Stopping', subject: 'Container' });
const RESTART_CONTAINER_TOAST = createCrudToastOptions({ action: 'Restarting', subject: 'Container' });
const DELETE_CONTAINER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Container' });

const fetchContainers = (params: PaginationParams & FolderedListingContext): Promise<PaginatedResponse<ContainerEntity>> => {
    return containerQuery.useListQuery.fetch({
        page: params.page,
        limit: params.limit,
        folderId: params.folderId ?? ROOT_FOLDER_ID,
        ...(params.search ? { search: params.search } : {})
    });
};

const fetchFolders = (folderId: string | null): Promise<PaginatedResponse<ContainerFolder>> => {
    return containerFoldersQuery.fetch({
        page: 1,
        limit: FOLDER_LIST_LIMIT,
        ...(folderId ? { parentId: folderId } : {})
    });
};

const fetchFolderById = (folderId: string): Promise<ContainerFolder> => {
    return containerFolderQuery.fetch({ folderId });
};

const getDeleteConfirmationMessage = (selectedItems: ContainerEntity[]): string => {
    if (selectedItems.length === 1) {
        return `Delete container "${selectedItems[0].name}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} containers? This action cannot be undone.`;
};

const useContainersListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['container:create']);
    const canMoveContainers = canAccess(['container:update']);
    const updateContainerMutation = containerQuery.useUpdateMutation();
    const deleteContainerMutation = containerQuery.useDeleteMutation();
    const { mutateAsync: createFolder } = useCreateContainerFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateContainerFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteContainerFolderMutation();
    const { mutateAsync: moveContainer } = useMoveContainerMutation();

    const [terminalContainer, setTerminalContainer] = useState<ContainerEntity | null>(null);

    const {
        breadcrumbs,
        context,
        currentFolder,
        currentFolderId,
        fetchData,
        getMoveFolder,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleDeleteFolder,
        handleRenameFolderClose: handleRenameFolderStateClose,
        handleRenameFolderOpen: handleRenameFolderStateOpen,
        handleRenameFolderSubmit: handleRenameFolderStateSubmit,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    } = useFolderedListing<ContainerEntity, ContainerFolder, ContainerListingRow>({
        teamId,
        fetchItems: fetchContainers,
        fetchFolders,
        getFolder: fetchFolderById,
        createEmptyResponse: createEmptyPaginatedResponse,
        mapFolderRow: createContainerFolderRow,
        mapItemRow: createContainerItemRow,
        onFetchErrorTitle: 'Failed to fetch containers',
        invalidFolderMessage: 'This container folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: CREATE_FOLDER_TOAST,
        updateFolder,
        renameFolderToast: RENAME_FOLDER_TOAST,
        deleteFolder,
        deleteFolderToast: DELETE_FOLDER_TOAST,
        getDeleteFolderConfirm: (folder) => ({
            title: `Delete "${folder.title}"? Nested folders and all containers inside them will be deleted recursively.`,
            description: 'This permanently deletes the folder tree and every container contained in it.'
        })
    });

    const {
        handleRenameFolderOpen,
        handleRenameFolderClose,
        handleRenameFolderSubmit
    } = useRenameFolderModal({
        modalId: RENAME_CONTAINER_FOLDER_MODAL_ID,
        openRenameState: handleRenameFolderStateOpen,
        closeRenameState: handleRenameFolderStateClose,
        submitRenameState: handleRenameFolderStateSubmit
    });

    const controlContainer = useCallback(async (containerId: string, action: ContainerAction) => {
        await updateContainerMutation.mutateAsync({ id: containerId, params: { action } });
    }, [updateContainerMutation]);

    const handleCreate = useCallback(() => {
        const nextPath = currentFolderId
            ? `/dashboard/containers/new?folderId=${encodeURIComponent(currentFolderId)}`
            : '/dashboard/containers/new';
        navigate(nextPath);
    }, [currentFolderId, navigate]);

    const moveContainerToFolder = useCallback((containerId: string, folderId: string | null) => {
        return moveContainer({ containerId, folderId });
    }, [moveContainer]);

    const {
        movingItem: movingContainer,
        handleMoveOpen: handleMoveContainerOpen,
        handleMoveClose: handleMoveContainerClose,
        handleMoveSubmit: handleMoveContainerSubmit
    } = useFolderedListingMoveModal<ContainerEntity, ContainerMoveTarget>({
        modalId: MOVE_CONTAINER_MODAL_ID,
        getMoveTarget: getContainerMoveTarget,
        moveItem: moveContainerToFolder,
        moveToast: MOVE_CONTAINER_TOAST
    });

    const { getMenuOptions: getContainerMenuOptions } = useListingActions<ContainerEntity>({
        actions: {
            view: {
                label: 'View Details',
                icon: Box,
                handler: ({ item: container }) => navigate(`/dashboard/containers/${container._id}`),
                requiredPermission: 'container:read'
            },
            terminal: {
                label: 'Open Terminal',
                icon: RiTerminalLine,
                handler: ({ item: container }) => {
                    if (container.status === 'running') {
                        setTerminalContainer(container);
                        return;
                    }

                    sileo.error({ title: 'Container must be running to open terminal' });
                },
                requiredPermission: 'container:read'
            },
            move: {
                label: 'Move to Folder',
                icon: FolderInput,
                handler: ({ item: container }) => handleMoveContainerOpen(container),
                requiredPermission: 'container:update'
            },
            start: {
                label: 'Start',
                icon: Play,
                handler: async ({ item: container }) => {
                    if (container.status === 'running') return;
                    await showPromise(controlContainer(container._id, ContainerAction.Start), START_CONTAINER_TOAST);
                },
                requiredPermission: 'container:update'
            },
            stop: {
                label: 'Stop',
                icon: Square,
                handler: async ({ item: container }) => {
                    if (container.status !== 'running') return;
                    await showPromise(controlContainer(container._id, ContainerAction.Stop), STOP_CONTAINER_TOAST);
                },
                requiredPermission: 'container:update'
            },
            restart: {
                label: 'Restart',
                icon: RotateCcw,
                handler: async ({ item: container }) => {
                    await showPromise(controlContainer(container._id, ContainerAction.Restart), RESTART_CONTAINER_TOAST);
                },
                requiredPermission: 'container:update'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: container }) => {
                    await showPromise(deleteContainerMutation.mutateAsync(container._id), DELETE_CONTAINER_TOAST);
                },
                confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'container:delete'
            }
        }
    });

    const { getMenuOptions: getFolderMenuOptions } = useListingActions<ContainerFolder>({
        actions: {
            open: {
                label: 'Open Folder',
                icon: FolderOpen,
                handler: ({ item }) => openFolder(item._id)
            },
            rename: {
                label: 'Rename Folder',
                icon: Pencil,
                handler: ({ item }) => handleRenameFolderOpen(item),
                requiredPermission: 'container:update'
            },
            delete: {
                label: 'Delete Folder',
                icon: Trash2,
                variant: 'danger',
                handler: async ({ item }) => handleDeleteFolder(item),
                requiredPermission: 'container:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: ContainerListingRow, selectedItems: ContainerListingRow[]): MenuOption[] => {
        if (isContainerFolderRow(item)) {
            return getFolderMenuOptions(item, [item]);
        }

        const selectedContainers = selectedItems.filter(isContainerItemRow);
        return getContainerMenuOptions(item, selectedContainers).filter((option) => {
            if (option.label === 'Start' && item.status === 'running') return false;
            if (option.label === 'Stop' && item.status !== 'running') return false;
            if (option.label === 'Open Terminal' && item.status !== 'running') return false;
            return true;
        });
    }, [getContainerMenuOptions, getFolderMenuOptions]);

    const handleItemClick = useCallback((item: ContainerListingRow): boolean => {
        if (isContainerFolderRow(item)) {
            openFolder(item._id);
            return true;
        }

        navigate(`/dashboard/containers/${item._id}`);
        return true;
    }, [navigate, openFolder]);

    const dragAndDrop = useFolderedListingDragAndDropMove({
        canMove: canMoveContainers,
        activationDistance: 6,
        getDraggableId: getContainerListingDraggableId,
        getDroppableId: getContainerListingDroppableId,
        isItemRow: isContainerItemRow,
        isFolderRow: isContainerFolderRow,
        moveItem: moveContainerToFolder,
        moveToast: MOVE_CONTAINER_TOAST
    });

    return {
        breadcrumbs,
        canCreate,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveContainerClose,
        handleMoveContainerSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        listMoveFolders,
        movingContainer,
        navigateToFolder,
        queryKey: containerQuery.QUERY_KEYS.lists(),
        renamingFolder,
        socketInvalidation: SOCKET_INVALIDATION,
        terminalContainer,
        closeTerminal: () => setTerminalContainer(null)
    };
};

export default useContainersListing;
