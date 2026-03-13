import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import trajectoryService from '@/modules/trajectory/api/services/trajectory';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useDeleteSelectedTrajectories from '@/modules/trajectory/hooks/trajectory/use-delete-selected-trajectories';
import useDownloadSamples from '@/modules/trajectory/hooks/trajectory/use-download-samples';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { Download, Upload } from 'lucide-react';
import { sileo } from 'sileo';
import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
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

    const { selectedIds, isSelected, toggleSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();

    const hideItemRef = useRef<((id: string) => void) | null>(null);

    const [samplesDownloaded, setSamplesDownloaded] = useState(false);
    const { downloadAllSamples, isDownloading } = useDownloadSamples();

    const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
        if(selectedIds.length === 0) return;

        const hasModifierKey = [e.ctrlKey, e.metaKey].some(Boolean);
        const isDeleteKey = ['Backspace', 'Delete'].includes(e.key);
        const isDeleteShortcut = hasModifierKey && isDeleteKey;
        if(isDeleteShortcut){
            e.preventDefault();
            selectedIds.forEach((id) => hideItemRef.current?.(id));
            await deleteSelectedTrajectories();
        }
    }, [selectedIds.length, deleteSelectedTrajectories]);

    const handleDownloadSamples = useCallback(async () => {
        try{
            await downloadAllSamples();
            setSamplesDownloaded(true);
        }catch{
            sileo.error({ title: 'Failed to download sample simulations' });
        }
    }, [downloadAllSamples]);

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

    const handleHideItem = useCallback((id: string) => {
        hideItemRef.current?.(id);
    }, []);

    const renderGridItem = useCallback((item: SimulationGridItem) => {
        return (
            <SimulationCard
                key={item._id}
                trajectory={item}
                isSelected={isSelected(item._id)}
                onSelect={toggleSelection}
                onDelete={handleHideItem}
            />
        );
    }, [isSelected, toggleSelection, handleHideItem]);

    const renderGridSkeleton = useCallback(() => (
        <SimulationSkeletonCard />
    ), []);

    const emptyStateConfig = useMemo(() => {
        if (samplesDownloaded) {
            return {
                icon: <Upload size={24} strokeWidth={1.5} />,
                title: 'Drop your files',
                message: 'Drag any downloaded simulation here to begin',
                buttonText: undefined,
                onButtonClick: undefined
            };
        }

        return {
            icon: <Download size={24} strokeWidth={1.5} />,
            title: 'No simulations yet',
            message: 'Upload a trajectory file or download samples to get started',
            buttonText: 'Download Samples',
            onButtonClick: handleDownloadSamples
        };
    }, [samplesDownloaded, handleDownloadSamples]);

    return (
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
            emptyButtonIsLoading={isDownloading}
            onEmptyButtonClick={emptyStateConfig.onButtonClick}
            onHideItemRef={hideItemRef}
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
    );
}
