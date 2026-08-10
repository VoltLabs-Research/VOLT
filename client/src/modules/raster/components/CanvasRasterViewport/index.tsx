import { useRasterWorkspace } from '@/modules/raster/hooks/use-raster-workspace';
import { createDefaultRasterContainerSelection, createInitialRasterContainerSelections } from '@/modules/raster/contracts/container-selection';
import { Spinner, cn } from '@heroui/react';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { ImageOff } from 'lucide-react';
import { sileo } from 'sileo';
import { useEffect, useMemo, useRef } from 'react';

import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/contracts/container-selection';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

/**
 * The two `var()`s below are CanvasPage's contract, not this component's: it
 * declares `--canvas-header-height` in CSS and writes
 * `--canvas-right-overlay-size` inline as the right rail opens and closes, and
 * the viewport insets itself by both. They stay as `var()` references — reading
 * them is the whole point — so they travel as arbitrary values.
 *
 * `items-stretch` is deliberate on the split row even though a flex row's
 * default is already stretch: the stylesheet this replaced set
 * `align-items: stretch` on `.canvas-raster-viewport` from an unlayered rule,
 * which outranked the `items-center` the layout codemod had left on the
 * element. Stretch is therefore what this row has always rendered as, and
 * `items-center` was dead. Emitting `items-stretch` keeps the panels
 * full-height; restoring `items-center` would collapse them to their content.
 */
const VIEWPORT_INSET = 'pt-[var(--canvas-header-height,55px)] pr-[var(--canvas-right-overlay-size,0px)]';

/**
 * The panel's content well — one class list shared by the image, the spinner and
 * every empty/error state so they all occupy exactly the same box. `rounded-lg`
 * is 8px, the pixel value the old `var(--radius-sm)` resolved to.
 */
const FRAME = 'flex flex-row items-center justify-center flex-1 min-h-0 bg-surface rounded-lg p-4';

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
        <div className='flex flex-row items-center gap-3 min-w-0 max-w-[min(100%,34rem)] max-[1024px]:flex-wrap max-[1024px]:justify-end'>
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
        <div className='flex flex-col flex-1 min-h-0 first:border-r first:border-border'>
            <PanelHeader title={selection.title} variant='compact' actions={headerActions} />
            <div className='flex flex-col flex-1 min-h-0 p-3 gap-3'>
                {vm.sourceDescription && (
                    <p className='text-xs text-muted px-1'>
                        {vm.sourceDescription}
                    </p>
                )}
                {isShowingFallbackTimestep && (
                    <p className='text-xs text-muted px-1'>
                        Showing frame {vm.displayTimestep} because the current timestep is not available for this selection.
                    </p>
                )}
                {vm.isLoading ? (
                    <div className={FRAME}>
                        <Spinner size='sm' className='text-muted' />
                    </div>
                ) : vm.error ? (
                    <div className={FRAME}>
                        <RecoveryState
                            title='Unable to load raster output'
                            description={vm.error.message}
                            tone={RecoveryStateTone.Error}
                            onRetry={() => vm.refetchMetadata()}
                        />
                    </div>
                ) : vm.isSelectionUnavailable ? (
                    <div className={FRAME}>
                        <RecoveryState
                            icon={<ImageOff size={24} />}
                            title='No raster output for this analysis'
                            description='The selected analysis does not have raster output yet. Choose another source in Scene Collection or run rasterization.'
                        />
                    </div>
                ) : vm.isFrameMissing || !vm.imageUrl ? (
                    <div className={FRAME}>
                        <RecoveryState
                            icon={<ImageOff size={24} />}
                            title='Raster frame unavailable'
                            description={frameUnavailableDescription}
                        />
                    </div>
                ) : (
                    <div className={cn(FRAME, 'overflow-hidden')}>
                        <img
                            className='w-full h-full object-contain'
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
            <div className={cn('flex flex-col flex-1 min-h-0 items-stretch', VIEWPORT_INSET)}>
                <RecoveryState
                    icon={<ImageOff size={24} />}
                    title='No rasterized frames available'
                    description='This trajectory does not have raster output yet. Run rasterization to populate the Raster workspace.'
                />
            </div>
        );
    }

    if (metadataVm.error) {
        return (
            <div className={cn('flex flex-col flex-1 min-h-0 items-stretch', VIEWPORT_INSET)}>
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
        <div className={cn('flex flex-row items-stretch flex-1 min-h-0 max-[1024px]:flex-col', VIEWPORT_INSET)}>
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
