import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteSelectedTrajectories from '../../../hooks/trajectory/use-delete-selected-trajectories';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import type { Trajectory, TrajectoryStatus } from '@/modules/trajectory/domain/entities';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';
import type { FrameJobGroupStatus } from '@/modules/jobs/domain/entities/Job';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { TrajectoryUploadState } from '../../../stores/use-trajectory-store';

interface SimulationGridContext {
    teamId?: string;
};

const mapGroupStatusToTrajectoryStatus = (status: FrameJobGroupStatus): TrajectoryStatus => {
    switch(status){
    case 'queued':
        return 'queued';
    case 'running':
    case 'partial':
        return 'processing';
    case 'failed':
        return 'failed';
    case 'completed':
        return 'completed';
    default:
        return 'processing';
    }
};

const SimulationGrid = () => {
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const optimisticTrajectories = useTrajectoryStore((state) => state.trajectories);
    const patchTrajectory = useTrajectoryStore((state) => state.patchTrajectory);
    const jobGroups = useTeamJobsStore((state) => state.groups);
    
    const selectedTeam = useSelectedTeam()!;
    const getTrajectories = useGetTrajectories();

    const { selectedIds, isSelected, toggleSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();

    const hideItemRef = useRef<((id: string) => void) | null>(null);

    const [samplesDownloaded, setSamplesDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const activeUploadEntries = useMemo(() => Object.entries(activeUploads), [activeUploads]);
    const visibleOptimisticTrajectories = useMemo(() => {
        return optimisticTrajectories.filter((trajectory) => {
            const teamId = typeof trajectory.team === 'string' ? trajectory.team : trajectory.team?._id;
            return !teamId || teamId === selectedTeam._id;
        });
    }, [optimisticTrajectories, selectedTeam._id]);

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
        setIsDownloading(true);
        try{
            // TODO: Implement trajectoryApi.downloadAllSamples() when trajectory API is migrated
            // await trajectoryApi.downloadAllSamples();
            setSamplesDownloaded(true);
        }catch{
            console.error('Failed to download sample simulations');
        }finally{
            setIsDownloading(false);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if(visibleOptimisticTrajectories.length === 0) return;

        visibleOptimisticTrajectories.forEach((trajectory) => {
            const group = jobGroups.find((entry) => entry.trajectoryId === trajectory._id);
            if(!group) return;

            const nextStatus = mapGroupStatusToTrajectoryStatus(group.overallStatus);
            const nextUpdatedAt = group.latestTimestamp || trajectory.updatedAt;

            if(trajectory.status === nextStatus && trajectory.updatedAt === nextUpdatedAt){
                return;
            }

            patchTrajectory(trajectory._id, {
                status: nextStatus,
                updatedAt: nextUpdatedAt
            });
        });
    }, [visibleOptimisticTrajectories, jobGroups, patchTrajectory]);

    const fetchData = useCallback(async (params: PaginationParams & SimulationGridContext): Promise<PaginatedResponse<Trajectory>> => {
        const result = await getTrajectories({ page: params.page, limit: params.limit });
        const optimisticTrajectoryIds = new Set(visibleOptimisticTrajectories.map((trajectory) => trajectory._id));

        return {
            status: 'success',
            data: result.data.filter((trajectory) => !optimisticTrajectoryIds.has(trajectory._id)),
            pagination: result.pagination
        };
    }, [getTrajectories, visibleOptimisticTrajectories]);

    const handleHideItem = useCallback((id: string) => {
        hideItemRef.current?.(id);
    }, []);

    const renderGridItem = useCallback((item: Trajectory) => {
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

    const prependItems = useMemo(() => (
        <>
            {activeUploadEntries.map(([id, upload]: [string, TrajectoryUploadState]) => (
                <SimulationSkeletonCard
                    key={`upload-${id}`}
                    progress={upload.progress}
                    status={upload.status}
                />
            ))}
            {visibleOptimisticTrajectories.map((trajectory) => (
                <SimulationCard
                    key={`optimistic-${trajectory._id}`}
                    trajectory={trajectory}
                    isSelected={isSelected(trajectory._id)}
                    onSelect={toggleSelection}
                    onDelete={handleHideItem}
                />
            ))}
        </>
    ), [activeUploadEntries, visibleOptimisticTrajectories, isSelected, toggleSelection, handleHideItem]);

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
        <DocumentListing<Trajectory, SimulationGridContext>
            title='Simulations'
            view='grid'
            fetchData={fetchData}
            prependItems={prependItems}
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
        />
    );
};

export default SimulationGrid;
