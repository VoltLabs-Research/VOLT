import { memo, useEffect, useCallback, useState, useMemo } from 'react';
import { Download, Upload } from 'lucide-react';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteSelectedTrajectories from '../../../hooks/trajectory/use-delete-selected-trajectories';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

interface SimulationGridContext {
    teamId?: string;
};

const SimulationGrid = memo(() => {
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    const setTrajectories = useTrajectoryStore((state) => state.setTrajectories);
    const appendTrajectories = useTrajectoryStore((state) => state.appendTrajectories);
    
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const getTrajectories = useGetTrajectories();

    const { selectedIds, isSelected, toggleSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();

    const [samplesDownloaded, setSamplesDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const activeUploadEntries = Object.entries(activeUploads);

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
        const handleKeyDown = async (e: KeyboardEvent) => {
            if(selectedIds.length === 0) return;
            
            const isDeleteShortcut = (e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete');
            if(isDeleteShortcut){
                e.preventDefault();
                await deleteSelectedTrajectories();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds.length, deleteSelectedTrajectories]);

    const fetchData = useCallback(async (params: { page: number; limit: number } & SimulationGridContext): Promise<PaginatedResponse<Trajectory>> => {
        const result = await getTrajectories({ page: params.page, limit: params.limit });
        return {
            status: 'success',
            data: result.data,
            pagination: result.pagination
        };
    }, [getTrajectories]);

    const handleDataFetched = useCallback((result: PaginatedResponse<Trajectory>, isFirstPage: boolean) => {
        if(isFirstPage){
            setTrajectories(result.data);
        }else{
            appendTrajectories(result.data);
        }
    }, [setTrajectories, appendTrajectories]);

    const handleContextChange = useCallback(() => {
        setTrajectories([]);
    }, [setTrajectories]);

    const renderGridItem = useCallback((trajectory: Trajectory) => (
        <SimulationCard
            key={trajectory._id}
            trajectory={trajectory}
            isSelected={isSelected(trajectory._id)}
            onSelect={toggleSelection}
        />
    ), [isSelected, toggleSelection]);

    const renderGridSkeleton = useCallback(() => (
        <>
            {activeUploadEntries.map(([id, uploadProgress]) => (
                <SimulationSkeletonCard key={id} progress={uploadProgress} status='uploading' />
            ))}
            <SimulationSkeletonCard />
        </>
    ), [activeUploadEntries]);

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
            data={trajectories}
            view='grid'
            fetchData={fetchData}
            onDataFetched={handleDataFetched}
            onContextChange={handleContextChange}
            context={{ teamId: selectedTeam?._id }}
            enabled={!!selectedTeam?._id}
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
        />
    );
});

SimulationGrid.displayName = 'SimulationGrid';

export default SimulationGrid;
