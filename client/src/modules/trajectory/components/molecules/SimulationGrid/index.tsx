import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import DocumentListing, { type SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '@/modules/trajectory/stores/use-trajectory-store';
import { fetchTrajectories } from '@/modules/trajectory/hooks/trajectory/queries';
import useDeleteSelectedTrajectories from '@/modules/trajectory/hooks/use-delete-selected-trajectories';
import useDownloadSamples from '@/modules/trajectory/hooks/use-download-samples';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { sileo } from 'sileo';
import type { TrajectoryUploadStatus } from '@/modules/trajectory/stores/use-trajectory-store';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'trajectory.created', queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()] },
    { event: 'trajectory.deleted', queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()] },
    { event: 'trajectory.updated', queryKeys: [TRAJECTORY_QUERY_KEYS.simulationGrid()] }
];

interface SimulationGridContext {
    teamId?: string;
};

export type SimulationGridItem =
    | { kind: 'upload'; _id: string; progress: number; status: TrajectoryUploadStatus }
    | { kind: 'trajectory'; _id: string; trajectory: Trajectory };

const SimulationGrid = () => {
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    
    const selectedTeam = useSelectedTeam()!;

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
        const result = await fetchTrajectories({ page: params.page, limit: params.limit });

        const items: SimulationGridItem[] = result.data
            .map((trajectory) => ({ kind: 'trajectory' as const, _id: trajectory._id, trajectory }));

        return {
            status: 'success',
            data: items,
            pagination: result.pagination
        };
    }, []);

    const transformData = useCallback((data: SimulationGridItem[]): SimulationGridItem[] => {
        const uploadItems: SimulationGridItem[] = Object.entries(activeUploads).map(
            ([id, upload]) => ({ kind: 'upload', _id: `upload-${id}`, progress: upload.progress, status: upload.status })
        );
        return [...uploadItems, ...data];
    }, [activeUploads]);

    const handleHideItem = useCallback((id: string) => {
        hideItemRef.current?.(id);
    }, []);

    const renderGridItem = useCallback((item: SimulationGridItem) => {
        if(item.kind === 'upload'){
            return (
                <SimulationSkeletonCard
                    key={item._id}
                    progress={item.progress}
                    status={item.status}
                />
            );
        }
        return (
            <SimulationCard
                key={item._id}
                trajectory={item.trajectory}
                isSelected={isSelected(item.trajectory._id)}
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
            transformData={transformData}
            context={{ teamId: selectedTeam._id }}
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
            socketInvalidation={SOCKET_INVALIDATION}
        />
    );
};

export default SimulationGrid;
