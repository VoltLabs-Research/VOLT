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
import { createFolderedListingResource } from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/utilities/toast-options';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { sileo } from 'sileo';
import { Box, FolderInput, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useState } from 'react';
import { RiTerminalLine } from 'react-icons/ri';
import { ContainerAction } from '../api/service';
import { useNavigate } from 'react-router-dom';

export const containersListingResource = createFolderedListingResource({
    subject: 'Container',
    singularName: 'container',
    pluralName: 'containers',
    permissionPrefix: 'container',
    listItems: containerQuery.useListQuery.fetch,
    listFolders: containerFoldersQuery.fetch,
    getFolder: containerFolderQuery.fetch
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_CONTAINER_EVENTS.CREATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.UPDATED, queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: SOCKET_CONTAINER_EVENTS.DELETED, queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

const START_CONTAINER_TOAST = createCrudToastOptions({ action: 'Starting', subject: 'Container' });
const STOP_CONTAINER_TOAST = createCrudToastOptions({ action: 'Stopping', subject: 'Container' });
const RESTART_CONTAINER_TOAST = createCrudToastOptions({ action: 'Restarting', subject: 'Container' });

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
                await showPromise(deleteContainerMutation.mutateAsync(container._id), containersListingResource.toasts.delete);
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

    const folderedListing = useFolderedResourceListing({
        teamId,
        ...containersListingResource.listingOptions,
        mapFolderRow: createContainerFolderRow,
        mapItemRow: createContainerItemRow,
        createFolder,
        updateFolder,
        deleteFolder,
        canMoveItems: canMoveContainers,
        getDraggableId: getContainerListingDraggableId,
        getDroppableId: getContainerListingDroppableId,
        isItemRow: isContainerItemRow,
        isFolderRow: isContainerFolderRow,
        moveItem: moveContainerToFolder,
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
        queryKey: containerQuery.QUERY_KEYS.lists(),
        socketInvalidation: SOCKET_INVALIDATION,
        terminalContainer,
        closeTerminal: () => setTerminalContainer(null)
    };
};

export default useContainersListing;
