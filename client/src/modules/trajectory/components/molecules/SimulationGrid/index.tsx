import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import trajectoryService from '@/modules/trajectory/api/services/trajectory';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useDeleteSelectedTrajectories from '@/modules/trajectory/hooks/trajectory/use-delete-selected-trajectories';
import useTrajectoryFilePicker from '@/modules/trajectory/hooks/trajectory/use-trajectory-file-picker';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { Download } from 'lucide-react';
import { useEffect, useCallback, useMemo } from 'react';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

interface SimulationGridContext {
    teamId?: string;
};

export type SimulationGridItem = Trajectory;

export default function SimulationGrid() {

    const selectedTeam = useSelectedTeam();
    const selectedTeamId = selectedTeam?._id;

    const { selectedIds, isSelected, toggleSelection, clearSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();
    const { fileInputRef, handlePickerChange, openFilePicker, isUploading } = useTrajectoryFilePicker();

    const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
        if(selectedIds.length === 0) return;

        const hasModifierKey = [e.ctrlKey, e.metaKey].some(Boolean);
        const isDeleteKey = ['Backspace', 'Delete'].includes(e.key);
        const isDeleteShortcut = hasModifierKey && isDeleteKey;
        if(isDeleteShortcut){
            e.preventDefault();
            if (selectedIds.length) {
                await deleteSelectedTrajectories();
                clearSelection();
            }
        }
    }, [selectedIds.length, deleteSelectedTrajectories, clearSelection]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const fetchData = useCallback(async (params: PaginationParams & SimulationGridContext): Promise<PaginatedResponse<SimulationGridItem>> => {
        const result = await trajectoryService.getAll({ page: params.page, limit: params.limit });

        return {
            status: 'success',
            data: result.data,
            pagination: result.pagination
        };
    }, []);

    const renderGridItem = useCallback((item: SimulationGridItem) => {
        return (
            <SimulationCard
                key={item._id}
                trajectory={item}
                isSelected={isSelected(item._id)}
                onSelect={toggleSelection}
            />
        );
    }, [isSelected, toggleSelection]);

    const renderGridSkeleton = useCallback(() => (
        <SimulationSkeletonCard />
    ), []);

    const emptyStateConfig = useMemo(() => {
        return {
            icon: <Download size={24} strokeWidth={1.5} />,
            title: 'No simulations yet',
            message: 'Upload a trajectory file to get started',
            buttonText: 'Upload trajectory',
            onButtonClick: openFilePicker
        };
    }, [openFilePicker]);

    return (
        <>
            <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                onChange={handlePickerChange}
            />
            <DocumentListing<SimulationGridItem, SimulationGridContext>
                title='Simulations'
                queryKey={TRAJECTORY_QUERY_KEYS.simulationGrid()}
                view='grid'
                fetchData={fetchData}
                context={selectedTeamId ? { teamId: selectedTeamId } : undefined}
                enabled={!!selectedTeamId}
                renderGridItem={renderGridItem}
                hideHeader={true}
                hideTabs={true}
                renderGridSkeleton={renderGridSkeleton}
                emptyIcon={emptyStateConfig.icon}
                emptyTitle={emptyStateConfig.title}
                emptyMessage={emptyStateConfig.message}
                emptyButtonText={emptyStateConfig.buttonText}
                emptyButtonIsLoading={isUploading}
                onEmptyButtonClick={emptyStateConfig.onButtonClick}
                socketInvalidation={[
                    {
                        event: 'trajectory.created',
                        queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()]
                    },
                    {
                        event: 'trajectory.updated',
                        queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()]
                    },
                    {
                        event: 'trajectory.deleted',
                        queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()]
                    }
                ]}
            />
        </>
    );
}
