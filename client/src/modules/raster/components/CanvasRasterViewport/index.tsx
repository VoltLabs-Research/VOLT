import { useRasterWorkspace } from '@/modules/raster/hooks/use-raster-workspace';
import { createDefaultRasterContainerSelection, createInitialRasterContainerSelections } from '@/modules/raster/contracts/container-selection';
import { EmptyState, Loader } from '@voltstack/bravais';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { ImageOff } from 'lucide-react';
import { sileo } from 'sileo';
import { useEffect, useMemo, useRef } from 'react';

import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/contracts/container-selection';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

import './CanvasRasterViewport.css';

interface CanvasRasterViewportProps {
    trajectoryId?: string;
    trajectory: Trajectory | null | undefined;
    currentTimestep?: number;
    containerSelections?: RasterContainerSelection[];
    onUpdateContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
};

interface RasterViewportPanelProps extends Pick<CanvasRasterViewportProps, 'trajectoryId' | 'currentTimestep' | 'onUpdateContainerSelection'> {
    selection: RasterContainerSelection;
};

const CONTAINER_ORDER: RasterContainerId[] = ['container-1', 'container-2'];

const RasterViewportPanel = ({
    selection,
    trajectoryId,
    currentTimestep,
    onUpdateContainerSelection
}: RasterViewportPanelProps) => {
    const handledUnavailableSelectionKeyRef = useRef<string | null>(null);
    const analysisId = selection.scene.source === 'plugin' ? selection.scene.analysisId : undefined;
    const vm = useRasterWorkspace({
        trajectoryId,
        analysisId,
        currentTimestep,
        model: selection.model,
        onModelChange: (model) => onUpdateContainerSelection?.(selection.id, { model: model ?? undefined })
    });

    useEffect(() => {
        const warning = !analysisId ? null : vm.isSelectionUnavailable ? {
            key: `selection:${selection.id}:${analysisId}`,
            title: 'Raster selection unavailable',
            description: 'The selected raster output is no longer available. This panel was reset to trajectory.'
        } : vm.isModelUnavailable ? {
            key: `model:${selection.id}:${analysisId}:${selection.model ?? 'unknown'}`,
            title: 'Raster model unavailable',
            description: 'The selected raster model is no longer available. This panel was reset to trajectory.'
        } : null;

        if (!warning) {
            handledUnavailableSelectionKeyRef.current = null;
            return;
        }

        if (handledUnavailableSelectionKeyRef.current === warning.key) {
            return;
        }

        handledUnavailableSelectionKeyRef.current = warning.key;
        sileo.warning({
            title: warning.title,
            description: warning.description
        });
        onUpdateContainerSelection?.(selection.id, createDefaultRasterContainerSelection(selection.id));
    }, [analysisId, onUpdateContainerSelection, selection.id, selection.model, vm.isModelUnavailable, vm.isSelectionUnavailable]);

    const headerActions = (
        <div className='flex flex-row items-center gap-3 canvas-raster-viewport__header-actions'>
            <p className='text-xs text-muted truncate'>
                {selection.label}
            </p>
        </div>
    );

    const isShowingFallbackTimestep = currentTimestep !== undefined && vm.displayTimestep !== undefined && currentTimestep !== vm.displayTimestep;

    const frameUnavailableDescription = vm.isAnalysisSource
        ? 'This timestep is not available for the selected raster model.'
        : 'This timestep does not have a rasterized trajectory frame yet.';

    return (
        <div className='flex flex-col flex-1 min-h-0 canvas-raster-viewport__panel'>
            <PanelHeader title={selection.title} variant='compact' actions={headerActions} />
            <div className='flex flex-col flex-1 min-h-0 canvas-raster-viewport__body'>
                {vm.sourceDescription && (
                    <p className='text-xs text-muted canvas-raster-viewport__hint'>
                        {vm.sourceDescription}
                    </p>
                )}
                {isShowingFallbackTimestep && (
                    <p className='text-xs text-muted canvas-raster-viewport__hint'>
                        Showing frame {vm.displayTimestep} because the current timestep is not available for this selection.
                    </p>
                )}
                {vm.isLoading ? (
                    <div className='flex flex-row items-center justify-center flex-1 min-h-0 canvas-raster-viewport__frame'>
                        <Loader scale={0.45} isFixed={false} />
                    </div>
                ) : vm.error ? (
                    <div className='flex flex-row items-center justify-center flex-1 min-h-0 canvas-raster-viewport__frame'>
                        <RecoveryState
                            title='Unable to load raster output'
                            description={vm.error.message}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => vm.refetchMetadata()}
                        />
                    </div>
                ) : vm.isSelectionUnavailable ? (
                    <div className='flex flex-row items-center justify-center flex-1 min-h-0 canvas-raster-viewport__frame'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='No raster output for this analysis'
                            description='The selected analysis does not have raster output yet. Choose another source in Scene Collection or run rasterization.'
                        />
                    </div>
                ) : vm.isFrameMissing || !vm.imageUrl ? (
                    <div className='flex flex-row items-center justify-center flex-1 min-h-0 canvas-raster-viewport__frame'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='Raster frame unavailable'
                            description={frameUnavailableDescription}
                        />
                    </div>
                ) : (
                    <div className='flex flex-row items-center justify-center overflow-hidden flex-1 min-h-0 canvas-raster-viewport__frame'>
                        <img
                            className='canvas-raster-viewport__image'
                            src={vm.imageUrl}
                            alt={`${selection.title} raster timestep ${vm.displayTimestep ?? 0}`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const CanvasRasterViewport = ({
    trajectoryId,
    currentTimestep,
    containerSelections,
    onUpdateContainerSelection
}: CanvasRasterViewportProps) => {
    const orderedSelections = useMemo(() => {
        const selections = containerSelections?.length ? containerSelections : createInitialRasterContainerSelections();
        return CONTAINER_ORDER.flatMap((containerId) => selections.find((selection) => selection.id === containerId) ?? []);
    }, [containerSelections]);

    const firstAnalysisSelection = orderedSelections.find((selection) => selection.scene.source === 'plugin');
    const metadataVm = useRasterWorkspace({
        trajectoryId,
        analysisId: firstAnalysisSelection?.scene.source === 'plugin' ? firstAnalysisSelection.scene.analysisId : undefined,
        currentTimestep
    });

    if (!metadataVm.hasRasterData && !metadataVm.isLoading) {
        return (
            <div className='flex flex-col flex-1 min-h-0 canvas-raster-viewport'>
                <EmptyState
                    icon={<ImageOff size={24} />}
                    title='No rasterized frames available'
                    description='This trajectory does not have raster output yet. Run rasterization to populate the Raster workspace.'
                />
            </div>
        );
    }

    if (metadataVm.error) {
        return (
            <div className='flex flex-col flex-1 min-h-0 canvas-raster-viewport'>
                <RecoveryState
                    title='Unable to load raster output'
                    description={metadataVm.error.message}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => metadataVm.refetchMetadata()}
                />
            </div>
        );
    }

    return (
        <div className='flex flex-row items-center flex-1 min-h-0 canvas-raster-viewport canvas-raster-viewport--split'>
            {orderedSelections.map((selection) => (
                <RasterViewportPanel
                    key={selection.id}
                    selection={selection}
                    trajectoryId={trajectoryId}
                    currentTimestep={currentTimestep}
                    onUpdateContainerSelection={onUpdateContainerSelection}
                />
            ))}
        </div>
    );
};

export default CanvasRasterViewport;
