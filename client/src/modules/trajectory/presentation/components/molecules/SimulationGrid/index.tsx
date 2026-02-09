import { useEffect, useCallback, useState, useMemo } from 'react';
import { Download, Upload } from 'lucide-react';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import SimulationCard from '../SimulationCard';
import SimulationSkeletonCard from '../../atoms/SimulationSkeletonCard';
import useTrajectoryStore from '../../../stores/use-trajectory-store';
import useGetTrajectories from '../../../hooks/trajectory/use-get-trajectories';
import useDeleteSelectedTrajectories from '../../../hooks/trajectory/use-delete-selected-trajectories';
import useSelectionParams from '@/shared/presentation/hooks/use-selection-params';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import type { Trajectory } from '@/modules/trajectory/domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

interface SimulationGridContext {
    teamId?: string;
};

const SimulationGrid = () => {
    const activeUploads = useTrajectoryStore((state) => state.activeUploads);
    
    const selectedTeam = useTeamStore((state) => state.selectedTeam)!;
    const getTrajectories = useGetTrajectories();

    const { selectedIds, isSelected, toggleSelection } = useSelectionParams();
    const deleteSelectedTrajectories = useDeleteSelectedTrajectories();

    const [samplesDownloaded, setSamplesDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const activeUploadEntries = Object.entries(activeUploads);

    const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
        if(selectedIds.length === 0) return;

        const hasModifierKey = [e.ctrlKey, e.metaKey].some(Boolean);
        const isDeleteKey = ['Backspace', 'Delete'].includes(e.key);
        const isDeleteShortcut = hasModifierKey && isDeleteKey;
        if(isDeleteShortcut){
            e.preventDefault();
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

    const fetchData = useCallback(async (params: PaginationParams & SimulationGridContext): Promise<PaginatedResponse<Trajectory>> => {
        const result = await getTrajectories({ page: params.page, limit: params.limit });
        return {
            status: 'success',
            data: result.data,
            pagination: result.pagination
        };
    }, [getTrajectories]);

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
            view='grid'
            fetchData={fetchData}
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
        />
    );
};

export default SimulationGrid;
