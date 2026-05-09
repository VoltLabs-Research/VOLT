import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
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
    type ContainerItemRow
} from '@/modules/container/utilities/listing';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import useFolderedResourceListing from '@/shared/presentation/hooks/use-foldered-resource-listing';
import {
    createFolderedResourceFetchers,
    createFolderResourceDeleteConfirm,
    FOLDER_RESOURCE_TOASTS
} from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { sileo } from 'sileo';
import { Box, FolderInput, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useState } from 'react';
import { RiTerminalLine } from 'react-icons/ri';
import { ContainerAction } from '../api/service';
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

const MOVE_CONTAINER_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Container' });
const START_CONTAINER_TOAST = createCrudToastOptions({ action: 'Starting', subject: 'Container' });
const STOP_CONTAINER_TOAST = createCrudToastOptions({ action: 'Stopping', subject: 'Container' });
const RESTART_CONTAINER_TOAST = createCrudToastOptions({ action: 'Restarting', subject: 'Container' });
const DELETE_CONTAINER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Container' });

const containerFetchers = createFolderedResourceFetchers({
    listItems: containerQuery.useListQuery.fetch,
    listFolders: containerFoldersQuery.fetch,
    getFolder: containerFolderQuery.fetch
});

const getDeleteFolderConfirm = createFolderResourceDeleteConfirm({
    pluralName: 'containers',
    singularName: 'container'
});

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

    const controlContainer = useCallback(async (containerId: string, action: ContainerAction) => {
        await updateContainerMutation.mutateAsync({ id: containerId, params: { action } });
    }, [updateContainerMutation]);

    const moveContainerToFolder = useCallback((containerId: string, folderId: string | null) => {
        return moveContainer({ containerId, folderId });
    }, [moveContainer]);

    const openContainer = useCallback((container: ContainerEntity) => {
        navigate(`/dashboard/containers/${container._id}`);
    }, [navigate]);

    const getContainerActions = useCallback(({ openMove }: { openMove: (container: ContainerItemRow) => void }): Record<string, ActionConfig<ContainerItemRow>> => ({
        view: {
            label: 'View Details',
            icon: Box,
            handler: ({ item: container }) => openContainer(container),
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
            handler: ({ item: container }) => openMove(container),
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
    }), [controlContainer, deleteContainerMutation, openContainer]);

    const filterContainerMenuOptions = useCallback((options: MenuOption[], { item }: { item: ContainerItemRow }): MenuOption[] => {
        return options.filter((option) => {
            if (option.label === 'Start' && item.status === 'running') return false;
            if (option.label === 'Stop' && item.status !== 'running') return false;
            if (option.label === 'Open Terminal' && item.status !== 'running') return false;
            return true;
        });
    }, []);

    const {
        handleMoveClose,
        handleMoveSubmit,
        movingItem,
        ...folderedListing
    } = useFolderedResourceListing({
        teamId,
        ...containerFetchers,
        mapFolderRow: createContainerFolderRow,
        mapItemRow: createContainerItemRow,
        onFetchErrorTitle: 'Failed to fetch containers',
        invalidFolderMessage: 'This container folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: FOLDER_RESOURCE_TOASTS.create,
        updateFolder,
        renameFolderToast: FOLDER_RESOURCE_TOASTS.rename,
        deleteFolder,
        deleteFolderToast: FOLDER_RESOURCE_TOASTS.delete,
        getDeleteFolderConfirm,
        renameFolderModalId: RENAME_CONTAINER_FOLDER_MODAL_ID,
        moveModalId: MOVE_CONTAINER_MODAL_ID,
        canMoveItems: canMoveContainers,
        activationDistance: 6,
        getDraggableId: getContainerListingDraggableId,
        getDroppableId: getContainerListingDroppableId,
        isItemRow: isContainerItemRow,
        isFolderRow: isContainerFolderRow,
        getMoveTarget: getContainerMoveTarget,
        moveItem: moveContainerToFolder,
        moveToast: MOVE_CONTAINER_TOAST,
        folderPermissions: {
            rename: 'container:update',
            delete: 'container:delete'
        },
        getItemActions: getContainerActions,
        mapItemMenuOptions: filterContainerMenuOptions,
        onOpenItem: openContainer
    });

    const handleCreate = useCallback(() => {
        const nextPath = folderedListing.currentFolderId
            ? `/dashboard/containers/new?folderId=${encodeURIComponent(folderedListing.currentFolderId)}`
            : '/dashboard/containers/new';
        navigate(nextPath);
    }, [folderedListing.currentFolderId, navigate]);

    return {
        ...folderedListing,
        canCreate,
        handleCreate,
        handleMoveContainerClose: handleMoveClose,
        handleMoveContainerSubmit: handleMoveSubmit,
        movingContainer: movingItem,
        queryKey: containerQuery.QUERY_KEYS.lists(),
        socketInvalidation: SOCKET_INVALIDATION,
        terminalContainer,
        closeTerminal: () => setTerminalContainer(null)
    };
};

export default useContainersListing;
