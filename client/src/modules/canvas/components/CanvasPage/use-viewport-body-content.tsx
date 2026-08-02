import CanvasRasterViewport from '@/modules/raster/components/CanvasRasterViewport';
import ScriptingWorkspace from '@/modules/scripting/components/ScriptingWorkspace';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import { EmptyState, Row } from '@voltstack/bravais';
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
    isScriptingWorkspace: boolean;
    isLocalGlbViewer: boolean;
    isLocalManifestLoading: boolean;
    localManifestError: string | null;
    forcedGlbUrl: string | null;
    showNoFramesState: boolean;
    rasterContainerSelections: RasterContainerSelection[];
    onUpdateRasterContainerSelection: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
    onJupyterUrlChange: (url: string | null) => void;
}

const centeredViewportState = (children: ReactNode, className?: string): ReactNode => (
    <Row justify='center' width='max' height='max' className={className}>
        {children}
    </Row>
);

const emptyViewportState = (title: string, description: string, className?: string): ReactNode => (
    centeredViewportState(<EmptyState title={title} description={description} />, className)
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
    isScriptingWorkspace,
    isLocalGlbViewer,
    isLocalManifestLoading,
    localManifestError,
    forcedGlbUrl,
    showNoFramesState,
    rasterContainerSelections,
    onUpdateRasterContainerSelection,
    onJupyterUrlChange
}: ViewportBodyContentParams): ReactNode | undefined => {
    const navigate = useNavigate();
    const { selectedNotebookId, setSelectedNotebookId } = useCanvasUrlState();

    const handleNotebookIdChange = useCallback((resolvedNotebookId: string) => {
        if (selectedNotebookId === resolvedNotebookId) {
            return;
        }

        setSelectedNotebookId(resolvedNotebookId, { replace: true });
    }, [selectedNotebookId, setSelectedNotebookId]);

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

        if (isScriptingWorkspace) {
            return (
                <ScriptingWorkspace
                    trajectoryId={trajectoryId}
                    notebookId={selectedNotebookId}
                    onJupyterUrlChange={onJupyterUrlChange}
                    onNotebookIdChange={handleNotebookIdChange}
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
                    'canvas-viewport-state'
                );
            }

            return emptyViewportState(
                'No timesteps yet',
                'This trajectory finished uploading but has no timesteps processed yet. Once ingestion completes they will appear here automatically.',
                'canvas-viewport-state'
            );
        }

        return undefined;
    }, [
        backToTrajectories,
        currentTimestep,
        forcedGlbUrl,
        handleNotebookIdChange,
        isLocalGlbViewer,
        isLocalManifestLoading,
        isRasterWorkspace,
        isScriptingWorkspace,
        localManifestError,
        onJupyterUrlChange,
        onUpdateRasterContainerSelection,
        rasterContainerSelections,
        selectedNotebookId,
        showNoFramesState,
        trajectory,
        trajectoryId
    ]);
};

export default useViewportBodyContent;
