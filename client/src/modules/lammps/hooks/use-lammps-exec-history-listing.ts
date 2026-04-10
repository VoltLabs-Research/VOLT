import {
    lammpsExecutionsQuery,
    lammpsExecutionsQueryKey,
    useDeleteLammpsExecutionMutation
} from '@/modules/lammps/hooks/queries';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LammpsExecution } from '@/modules/lammps/api/types';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

const DELETE_EXECUTION_TOAST = createCrudToastOptions({
    action: 'Deleting',
    subject: 'Execution',
    success: 'Execution deleted successfully',
    error: 'Failed to delete execution'
});

const useLammpsExecHistoryListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const deleteExecutionMutation = useDeleteLammpsExecutionMutation();

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<LammpsExecution>> => {
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

        return lammpsExecutionsQuery.fetch({
            teamId,
            page: params.page,
            limit: params.limit,
            search: params.search || undefined
        });
    }, [teamId]);

    const openInEditor = useCallback((execution: LammpsExecution) => {
        const scriptId = typeof execution.script === 'string'
            ? execution.script
            : execution.script?._id;
        if (!scriptId) {
            return;
        }

        navigate(`/dashboard/lammps/scripts/${scriptId}?selectedExec=${execution._id}&timestep=0`);
    }, [navigate]);

    const { getMenuOptions } = useListingActions<LammpsExecution>({
        actions: {
            open: {
                label: 'Open in Editor',
                requiredPermission: 'lammps:read',
                handler: ({ item }) => openInEditor(item)
            },
            import: {
                label: 'Import as trajectory',
                requiredPermission: 'lammps:create',
                handler: () => {},
                confirm: false
            },
            delete: {
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                requiredPermission: 'lammps:delete',
                confirm: ({ item }) => `Delete execution ${item._id.substring(0, 12)}? Generated dumps will be removed unless it was imported as a trajectory.`,
                handler: async ({ item }) => {
                    if (!teamId) {
                        return;
                    }

                    await showPromise(deleteExecutionMutation.mutateAsync({
                        teamId,
                        executionId: item._id
                    }), DELETE_EXECUTION_TOAST);
                }
            }
        }
    });

    return {
        canImport: canAccess(['trajectory:create']) || canAccess(['lammps:create']),
        fetchData,
        getMenuOptions,
        openInEditor,
        queryKey: lammpsExecutionsQueryKey()
    };
};

export default useLammpsExecHistoryListing;
