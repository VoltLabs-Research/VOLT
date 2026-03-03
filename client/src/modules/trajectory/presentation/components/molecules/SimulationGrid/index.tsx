import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import DocumentListing, { createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteSelectedTrajectories from '../../../hooks/trajectory/use-delete-selected-trajectories';
import useDownloadSamples from '../../../hooks/trajectory/use-download-samples';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import type { Trajectory, TrajectoryStatus } from '@/modules/trajectory/domain/entities';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';
import type { FrameJobGroupStatus } from '@/modules/jobs/domain/entities/Job';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import { sileo } from 'sileo';
import type { TrajectoryUploadStatus } from '../../../stores/use-trajectory-store';

const LIST_SYNC = createListSyncConfig('trajectory', ['deleted']);

interface SimulationGridContext {
    teamId?: string;
};

export type SimulationGridItem =
    | { kind: 'upload'; _id: string; progress: number; status: TrajectoryUploadStatus }
    | { kind: 'optimistic'; _id: string; trajectory: Trajectory }
    | { kind: 'trajectory'; _id: string; trajectory: Trajectory };

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
    const { downloadAllSamples, isDownloading } = useDownloadSamples();

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

    const fetchData = useCallback(async (params: PaginationParams & SimulationGridContext): Promise<PaginatedResponse<SimulationGridItem>> => {
        const result = await getTrajectories({ page: params.page, limit: params.limit });
        const optimisticIds = new Set(visibleOptimisticTrajectories.map((t) => t._id));

        const items: SimulationGridItem[] = result.data
            .filter((t) => !optimisticIds.has(t._id))
            .map((trajectory) => ({ kind: 'trajectory', _id: trajectory._id, trajectory }));

        return {
            status: 'success',
            data: items,
            pagination: result.pagination
        };
    }, [getTrajectories, visibleOptimisticTrajectories]);

    const transformData = useCallback((data: SimulationGridItem[]): SimulationGridItem[] => {
        const uploadItems: SimulationGridItem[] = Object.entries(activeUploads).map(
            ([id, upload]) => ({ kind: 'upload', _id: `upload-${id}`, progress: upload.progress, status: upload.status })
        );
        const optimisticItems: SimulationGridItem[] = visibleOptimisticTrajectories.map(
            (trajectory) => ({ kind: 'optimistic', _id: `optimistic-${trajectory._id}`, trajectory })
        );
        return [...uploadItems, ...optimisticItems, ...data];
    }, [activeUploads, visibleOptimisticTrajectories]);

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
            listSyncConfig={LIST_SYNC}
        />
    );
};

export default SimulationGrid;
