import { cn } from '@heroui/react';
import CanvasRasterViewport from '@/modules/raster/components/CanvasRasterViewport';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { EmptyState, Typography } from '@heroui/react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ReactNode } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/contracts/container-selection';

interface ViewportBodyContentParams {
    trajectory: Trajectory | null;
    trajectoryId: string;
    currentTimestep: number | undefined;
    isRasterWorkspace: boolean;
    isLocalGlbViewer: boolean;
    isLocalManifestLoading: boolean;
    localManifestError: string | null;
    forcedGlbUrl: string | null;
    showNoFramesState: boolean;
    rasterContainerSelections: RasterContainerSelection[];
    onUpdateRasterContainerSelection: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
}

const centeredViewportState = (children: ReactNode, className?: string): ReactNode => (
    <div className={cn('flex flex-row items-center justify-center w-full h-full', className)}>
        {children}
    </div>
);

/**
 * bravais's `EmptyState` took `title` / `description` props; HeroUI's is a single
 * polymorphic part whose children you compose. `level={3}` keeps bravais's default
 * heading level.
 */
const emptyViewportState = (title: string, description: string, className?: string): ReactNode => (
    centeredViewportState(
        <EmptyState>
            <Typography.Heading level={3}>{title}</Typography.Heading>
            <Typography.Paragraph size='sm'>{description}</Typography.Paragraph>
        </EmptyState>,
        className
    )
);

/**
 * Resolves what covers the 3D viewport: an alternate workspace, a local viewer
 * state or a trajectory recovery state. `undefined` means the scene shows
 * through untouched.
 */
const useViewportBodyContent = ({
    trajectory,
    trajectoryId,
    currentTimestep,
    isRasterWorkspace,
    isLocalGlbViewer,
    isLocalManifestLoading,
    localManifestError,
    forcedGlbUrl,
    showNoFramesState,
    rasterContainerSelections,
    onUpdateRasterContainerSelection
}: ViewportBodyContentParams): ReactNode | undefined => {
    const navigate = useNavigate();

    const backToTrajectories = useCallback(() => {
        navigate('/dashboard/trajectories/list');
    }, [navigate]);

    return useMemo(() => {
        if (isRasterWorkspace) {
            return (
                <CanvasRasterViewport
                    trajectoryId={trajectoryId}
                    trajectory={trajectory}
                    currentTimestep={currentTimestep}
                    containerSelections={rasterContainerSelections}
                    onUpdateContainerSelection={onUpdateRasterContainerSelection}
                />
            );
        }

        if (isLocalGlbViewer) {
            if (isLocalManifestLoading) {
                return emptyViewportState('Loading scene manifest', 'Resolving local viewer frames.');
            }

            if (localManifestError) {
                return emptyViewportState('Failed to load local scene manifest', localManifestError);
            }

            if (!forcedGlbUrl) {
                return emptyViewportState(
                    'Drop a GLB file to preview',
                    'Use the dashboard dropzone, or open /canvas/glb?url=... or /canvas/glb?manifest=....'
                );
            }
        }

        if (showNoFramesState) {
            if (trajectory?.status === 'failed') {
                return centeredViewportState(
                    <RecoveryState
                        tone={RecoveryStateTone.Error}
                        title="Couldn't process this trajectory"
                        description='Ingestion failed for this file. It may be an unsupported format or contain no readable timesteps. Supported uploads are LAMMPS dump/data files (.dump, .lammpstrj, .data, .lammps).'
                        retryLabel='Back to trajectories'
                        onRetry={backToTrajectories}
                    />,
                    'z-[1] p-6'
                );
            }

            return emptyViewportState(
                'No timesteps yet',
                'This trajectory finished uploading but has no timesteps processed yet. Once ingestion completes they will appear here automatically.',
                'z-[1] p-6'
            );
        }

        return undefined;
    }, [
        backToTrajectories,
        currentTimestep,
        forcedGlbUrl,
        isLocalGlbViewer,
        isLocalManifestLoading,
        isRasterWorkspace,
        localManifestError,
        onUpdateRasterContainerSelection,
        rasterContainerSelections,
        showNoFramesState,
        trajectory,
        trajectoryId
    ]);
};

export default useViewportBodyContent;
