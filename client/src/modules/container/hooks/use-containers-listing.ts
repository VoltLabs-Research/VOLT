import type { Container as ContainerEntity } from '@volt/contracts/modules/container/domain';
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
    isContainerItemRow
} from '@/modules/container/utils/listing';
import type { ContainerItemRow } from '@/modules/container/contracts/listing';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/ui/components/DocumentListing';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import useFolderedResourceListing from '@/shared/ui/hooks/use-foldered-resource-listing';
import { createFolderedListingResource } from '@/shared/ui/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/ui/hooks/use-listing-actions';
import { showPromise } from '@/shared/ui/hooks/toast';
import { createCrudToastOptions } from '@/shared/ui/utils/toast-options';
import type { MenuOption } from '@/shared/contracts/menu';
import { sileo } from 'sileo';
import { Box, FolderInput, Play, RotateCcw, Square, Terminal } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ContainerAction } from '../api/service';
import { useNavigate } from 'react-router-dom';

export const containersListingResource = createFolderedListingResource({
    subject: 'Container',
    singularName: 'container',
    pluralName: 'containers',
    permissionPrefix: 'container',
    getItemTitle: (container: ContainerEntity) => container.name,
    listItems: containerQuery.useListQuery.fetch,
    listFolders: containerFoldersQuery.fetch,
    getFolder: containerFolderQuery.fetch
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    SOCKET_CONTAINER_EVENTS.CREATED,
    SOCKET_CONTAINER_EVENTS.UPDATED,
    SOCKET_CONTAINER_EVENTS.DELETED
].map((event) => ({
    event,
    queryKeys: [containerQuery.QUERY_KEYS.lists()]
}));

const START_CONTAINER_TOAST = createCrudToastOptions({
    action: 'Starting',
    subject: 'Container'
});
const STOP_CONTAINER_TOAST = createCrudToastOptions({
    action: 'Stopping',
    subject: 'Container'
});
const RESTART_CONTAINER_TOAST = createCrudToastOptions({
    action: 'Restarting',
    subject: 'Container'
});

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
        await updateContainerMutation.mutateAsync({
            id: containerId,
            params: { action }
        });
    }, [updateContainerMutation]);

    const moveContainerToFolder = useCallback((containerId: string, folderId: string | null) => {
        return moveContainer({
            containerId,
            folderId
        });
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
            icon: Terminal,
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
            confirm: ({ selectedItems }) => containersListingResource.getDeleteConfirmationMessage(selectedItems),
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
