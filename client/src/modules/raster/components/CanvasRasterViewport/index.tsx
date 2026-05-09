import { useRasterWorkspace } from '@/modules/raster/hooks/use-raster-workspace';
import { createDefaultRasterContainerSelection, createInitialRasterContainerSelections } from '@/modules/raster/types/container-selection';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { ImageOff } from 'lucide-react';
import { sileo } from 'sileo';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

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
    const handledUnavailableSelectionKeyRef = useRef<string | null>(null);
    const analysisId = selection.scene.source === 'plugin' ? selection.scene.analysisId : undefined;
    const vm = useRasterWorkspace({
        trajectoryId,
        trajectory,
        analysisId,
        currentTimestep,
        model: selection.model,
        onModelChange: (model) => onUpdateContainerSelection?.(selection.id, { model: model ?? undefined })
    });

    useEffect(() => {
        let warningKey: string | null = null;
        let warningTitle = '';
        let warningDescription = '';

        if (vm.isSelectionUnavailable && selection.scene.source === 'plugin') {
            warningKey = `selection:${selection.id}:${selection.scene.analysisId}`;
            warningTitle = 'Raster selection unavailable';
            warningDescription = 'The selected raster output is no longer available. This panel was reset to trajectory.';
        } else if (vm.isModelUnavailable && selection.scene.source === 'plugin') {
            warningKey = `model:${selection.id}:${selection.scene.analysisId}:${selection.model ?? 'unknown'}`;
            warningTitle = 'Raster model unavailable';
            warningDescription = 'The selected raster model is no longer available. This panel was reset to trajectory.';
        }

        if (!warningKey) {
            handledUnavailableSelectionKeyRef.current = null;
            return;
        }

        if (handledUnavailableSelectionKeyRef.current === warningKey) {
            return;
        }

        handledUnavailableSelectionKeyRef.current = warningKey;
        sileo.warning({
            title: warningTitle,
            description: warningDescription
        });
        onUpdateContainerSelection?.(selection.id, createDefaultRasterContainerSelection(selection.id));
    }, [onUpdateContainerSelection, selection.id, selection.model, selection.scene, vm.isModelUnavailable, vm.isSelectionUnavailable]);

    const headerActions = (
        <Row gap='075' className='canvas-raster-viewport__header-actions'>
            <Text as='p' size='xs' tone='secondary' truncate>
                {selection.label}
            </Text>
        </Row>
    );

    const resolvedTimestep = vm.displayTimestep;
    const isShowingFallbackTimestep = currentTimestep !== undefined && resolvedTimestep !== undefined && currentTimestep !== resolvedTimestep;

    const frameUnavailableDescription = vm.isAnalysisSource
        ? 'This timestep is not available for the selected raster model.'
        : 'This timestep does not have a rasterized trajectory frame yet.';

    return (
        <Stack flex='1' minH='0' className='canvas-raster-viewport__panel'>
            <PanelHeader title={selection.title} variant='compact' actions={headerActions} />
            <Stack flex='1' minH='0' className='canvas-raster-viewport__body'>
                {vm.sourceDescription && (
                    <Text as='p' size='xs' tone='secondary' className='canvas-raster-viewport__hint'>
                        {vm.sourceDescription}
                    </Text>
                )}
                {isShowingFallbackTimestep && (
                    <Text as='p' size='xs' tone='secondary' className='canvas-raster-viewport__hint'>
                        Showing frame {resolvedTimestep} because the current timestep is not available for this selection.
                    </Text>
                )}
                {vm.isLoading ? (
                    <Row justify='center' flex='1' minH='0' className='canvas-raster-viewport__frame'>
                        <Loader scale={0.45} isFixed={false} />
                    </Row>
                ) : vm.error ? (
                    <Row justify='center' flex='1' minH='0' className='canvas-raster-viewport__frame'>
                        <RecoveryState
                            title='Unable to load raster output'
                            description={vm.error.message}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => vm.refetchMetadata()}
                        />
                    </Row>
                ) : vm.isSelectionUnavailable ? (
                    <Row justify='center' flex='1' minH='0' className='canvas-raster-viewport__frame'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='No raster output for this analysis'
                            description='The selected analysis does not have raster output yet. Choose another source in Scene Collection or run rasterization.'
                        />
                    </Row>
                ) : vm.isFrameMissing || !vm.frame?.imageUrl ? (
                    <Row justify='center' flex='1' minH='0' className='canvas-raster-viewport__frame'>
                        <EmptyState
                            icon={<ImageOff size={24} />}
                            title='Raster frame unavailable'
                            description={frameUnavailableDescription}
                        />
                    </Row>
                ) : (
                    <Row justify='center' flex='1' minH='0' overflow='hidden' className='canvas-raster-viewport__frame'>
                        <img
                            className='canvas-raster-viewport__image'
                            src={vm.frame.imageUrl}
                            alt={`${selection.title} raster timestep ${resolvedTimestep ?? 0}`}
                        />
                    </Row>
                )}
            </Stack>
        </Stack>
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
            <Stack flex='1' minH='0' className='canvas-raster-viewport'>
                <EmptyState
                    icon={<ImageOff size={24} />}
                    title='No rasterized frames available'
                    description='This trajectory does not have raster output yet. Run rasterization to populate the Raster workspace.'
                />
            </Stack>
        );
    }

    if (metadataVm.error) {
        return (
            <Stack flex='1' minH='0' className='canvas-raster-viewport'>
                <RecoveryState
                    title='Unable to load raster output'
                    description={metadataVm.error.message}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => metadataVm.refetchMetadata()}
                />
            </Stack>
        );
    }

    return (
        <Row flex='1' minH='0' className='canvas-raster-viewport canvas-raster-viewport--split'>
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
        </Row>
    );
};

export default CanvasRasterViewport;
