import {
    lammpsContainersQuery,
    lammpsContainersQueryKey,
    useDeleteLammpsContainerMutation
} from '@/modules/lammps/hooks/queries';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import type { LammpsContainer } from '@/modules/lammps/api/types';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';

const DELETE_CONTAINER_TOAST = createCrudToastOptions({
    action: 'Deleting',
    subject: 'LAMMPS container',
    success: 'Container deleted successfully',
    error: 'Failed to delete container'
});

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'lammps_container_progress', queryKeys: [lammpsContainersQueryKey()] }
];

const useLammpsContainersListing = () => {
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['lammps:create']);
    const deleteContainerMutation = useDeleteLammpsContainerMutation();

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<LammpsContainer>> => {
        if (!teamId) {
            return {
                status: 'success',
                data: [],
                pagination: {
                    page: params.page,
                    limit: params.limit,
                    total: 0,
                    totalPages: 1,
                    hasMore: false
                }
            };
        }

        return lammpsContainersQuery.fetch({
            teamId,
            page: params.page,
            limit: params.limit,
            search: params.search || undefined
        });
    }, [teamId]);

    const { getMenuOptions } = useListingActions<LammpsContainer>({
        actions: {
            delete: {
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                requiredPermission: 'lammps:delete',
                confirm: ({ item }) => `Delete "${item.name}"? This container and its workspace will be removed.`,
                handler: async ({ item }) => {
                    if (!teamId) {
                        return;
                    }

                    await showPromise(
                        deleteContainerMutation.mutateAsync({
                            teamId,
                            containerId: item._id
                        }),
                        DELETE_CONTAINER_TOAST
                    );
                }
            }
        }
    });

    return {
        canCreate,
        fetchData,
        getMenuOptions,
        queryKey: lammpsContainersQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useLammpsContainersListing;
