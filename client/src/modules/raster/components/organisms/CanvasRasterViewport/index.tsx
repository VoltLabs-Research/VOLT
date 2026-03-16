import { useRasterWorkspace } from '@/modules/raster/hooks/use-raster-workspace';
import { createInitialRasterContainerSelections } from '@/modules/raster/types/container-selection';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { ImageOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './CanvasRasterViewport.css';

interface CanvasRasterViewportProps {
    trajectoryId?: string;
    trajectory: Trajectory | null | undefined;
    currentTimestep?: number;
    containerSelections?: RasterContainerSelection[];
    onUpdateContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
};

const createSelectionMap = (containerSelections?: RasterContainerSelection[]) => {
    const fallbackSelections = createInitialRasterContainerSelections();
    const resolvedSelections = containerSelections?.length ? containerSelections : fallbackSelections;

    return new Map<RasterContainerId, RasterContainerSelection>(resolvedSelections.map((selection) => [selection.id, selection]));
};

const RasterViewportPanel = ({
    selection,
    trajectoryId,
    trajectory,
    currentTimestep,
    onUpdateContainerSelection
}: {
    selection: RasterContainerSelection;
    trajectoryId?: string;
    trajectory: Trajectory | null | undefined;
    currentTimestep?: number;
    onUpdateContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
}) => {
    const analysisId = selection.scene.source === 'plugin' ? selection.scene.analysisId : undefined;
    const vm = useRasterWorkspace({
        trajectoryId,
        trajectory,
        analysisId,
        currentTimestep,
        model: selection.model,
        onModelChange: (model) => onUpdateContainerSelection?.(selection.id, { model: model ?? undefined })
    });

    const headerActions = (
        <Container className='canvas-raster-viewport__header-actions d-flex items-center gap-075'>
            <Paragraph className='font-size-05 color-secondary text-truncate'>
                {selection.label}
            </Paragraph>
        </Container>
    );

    const resolvedTimestep = vm.displayTimestep;
    const isShowingFallbackTimestep = currentTimestep !== undefined && resolvedTimestep !== undefined && currentTimestep !== resolvedTimestep;

    const frameUnavailableDescription = vm.isAnalysisSource
        ? 'This timestep is not available for the selected raster model.'
        : 'This timestep does not have a rasterized trajectory frame yet.';

    return (
        <Container className='canvas-raster-viewport__panel d-flex column flex-1 min-h-0'>
            <PanelHeader title={selection.title} variant='compact' actions={headerActions} />
            <Container className='canvas-raster-viewport__body d-flex column flex-1 min-h-0'>
                {vm.sourceDescription && (
                    <Paragraph className='canvas-raster-viewport__hint font-size-05 color-secondary'>
                        {vm.sourceDescription}
                    </Paragraph>
                )}
                {isShowingFallbackTimestep && (
                    <Paragraph className='canvas-raster-viewport__hint font-size-05 color-secondary'>
                        Showing frame {resolvedTimestep} because the current timestep is not available for this selection.
                    </Paragraph>
                )}
                {vm.isLoading ? (
                    <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0'>
                        <Loader scale={0.45} isFixed={false} />
                    </Container>
                ) : vm.error ? (
                    <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0'>
                        <RecoveryState
                            title='Unable to load raster output'
                            description={vm.error.message}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => vm.refetchMetadata()}
                        />
                    </Container>
                ) : vm.isSelectionUnavailable ? (
                    <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='No raster output for this analysis'
                            description='The selected analysis does not have raster output yet. Choose another source in Scene Collection or run rasterization.'
                        />
                    </Container>
                ) : vm.isFrameMissing || !vm.frame?.imageUrl ? (
                    <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='Raster frame unavailable'
                            description={frameUnavailableDescription}
                        />
                    </Container>
                ) : (
                    <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0 overflow-hidden'>
                        <img
                            className='canvas-raster-viewport__image'
                            src={vm.frame.imageUrl}
                            alt={`${selection.title} raster timestep ${resolvedTimestep ?? 0}`}
                        />
                    </Container>
                )}
            </Container>
        </Container>
    );
};

const CanvasRasterViewport = ({
    trajectoryId,
    trajectory,
    currentTimestep,
    containerSelections,
    onUpdateContainerSelection
}: CanvasRasterViewportProps) => {
    const [selectionMap, setSelectionMap] = useState<Map<RasterContainerId, RasterContainerSelection>>(() => createSelectionMap(containerSelections));

    useEffect(() => {
        setSelectionMap(createSelectionMap(containerSelections));
    }, [containerSelections]);

    const orderedSelections = useMemo(() => {
        return (['container-1', 'container-2'] as RasterContainerId[])
            .map((id) => selectionMap.get(id))
            .filter((selection): selection is RasterContainerSelection => Boolean(selection));
    }, [selectionMap]);

    const firstAnalysisSelection = orderedSelections.find((selection) => selection.scene.source === 'plugin');
    const metadataVm = useRasterWorkspace({
        trajectoryId,
        trajectory,
        analysisId: firstAnalysisSelection?.scene.source === 'plugin' ? firstAnalysisSelection.scene.analysisId : undefined,
        currentTimestep
    });

    if (!metadataVm.hasRasterData && !metadataVm.isLoading) {
        return (
            <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
                <EmptyState
                    icon={<ImageOff size={24} />}
                    title='No rasterized frames available'
                    description='This trajectory does not have raster output yet. Run rasterization to populate the Raster workspace.'
                />
            </Container>
        );
    }

    if (metadataVm.error) {
        return (
            <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
                <RecoveryState
                    title='Unable to load raster output'
                    description={metadataVm.error.message}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => metadataVm.refetchMetadata()}
                />
            </Container>
        );
    }

    return (
        <Container className='canvas-raster-viewport canvas-raster-viewport--split d-flex flex-1 min-h-0'>
            {orderedSelections.map((selection) => (
                <RasterViewportPanel
                    key={selection.id}
                    selection={selection}
                    trajectoryId={trajectoryId}
                    trajectory={trajectory}
                    currentTimestep={currentTimestep}
                    onUpdateContainerSelection={onUpdateContainerSelection}
                />
            ))}
        </Container>
    );
};

export default CanvasRasterViewport;
