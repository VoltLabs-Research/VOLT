import { useRasterWorkspace } from '@/modules/raster/hooks/use-raster-workspace';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Select from '@/shared/presentation/components/Select';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { ImageOff } from 'lucide-react';

import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './CanvasRasterViewport.css';

interface CanvasRasterViewportProps {
    trajectoryId?: string;
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
    currentTimestep?: number;
};

const CanvasRasterViewport = ({
    trajectoryId,
    trajectory,
    analysisId,
    currentTimestep
}: CanvasRasterViewportProps) => {
    const vm = useRasterWorkspace({
        trajectoryId,
        trajectory,
        analysisId,
        currentTimestep
    });

    const shouldRenderModelSelect = vm.isAnalysisSource && vm.modelOptions.length > 1;

    let headerDescription = vm.sourceTitle;
    if (vm.selectedModelTitle) {
        headerDescription = `${headerDescription} · ${vm.selectedModelTitle}`;
    }

    const headerActions = (
        <Container className='canvas-raster-viewport__header-actions d-flex items-center gap-075'>
            <Paragraph className='font-size-05 color-secondary text-truncate'>
                {headerDescription}
            </Paragraph>
            {shouldRenderModelSelect && (
                <Select
                    options={vm.modelOptions}
                    value={vm.selectedModel}
                    onChange={vm.setSelectedModel}
                    placeholder='Model'
                    className='canvas-raster-viewport__select'
                    aria-label='Raster model selector'
                />
            )}
        </Container>
    );

    if (!vm.hasRasterData && !vm.isLoading) {
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

    if (!vm.isLoading && currentTimestep === undefined) {
        return (
            <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
                <EmptyState
                    icon={<ImageOff size={24} />}
                    title='No timestep selected'
                    description='Select a timestep from the canvas timeline to view the corresponding raster frame.'
                />
            </Container>
        );
    }

    if (vm.error) {
        return (
            <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
                <RecoveryState
                    title='Unable to load raster output'
                    description={vm.error.message}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => vm.refetchMetadata()}
                />
            </Container>
        );
    }

    if (!vm.isLoading && vm.isSelectionUnavailable) {
        return (
            <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
                <EmptyState
                    icon={<ImageOff size={24} />}
                    title='No raster output for this analysis'
                    description='The current canvas analysis does not have raster output yet. Select another analysis or run rasterization.'
                />
            </Container>
        );
    }

    const frameUnavailableDescription = vm.isAnalysisSource
        ? 'This timestep is not available for the selected raster model.'
        : 'This timestep does not have a rasterized trajectory frame yet.';

    return (
        <Container className='canvas-raster-viewport d-flex column flex-1 min-h-0'>
            <Container className='canvas-raster-viewport__panel d-flex column flex-1 min-h-0'>
                <PanelHeader title='Raster' variant='compact' actions={headerActions} />
                <Container className='canvas-raster-viewport__body d-flex column flex-1 min-h-0'>
                    {vm.sourceDescription && (
                        <Paragraph className='canvas-raster-viewport__hint font-size-05 color-secondary'>
                            {vm.sourceDescription}
                        </Paragraph>
                    )}
                    {vm.isLoading ? (
                        <Container className='canvas-raster-viewport__frame d-flex items-center content-center flex-1 min-h-0'>
                            <Loader scale={0.45} isFixed={false} />
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
                                alt={`Raster timestep ${currentTimestep ?? 0}`}
                            />
                        </Container>
                    )}
                </Container>
            </Container>
        </Container>
    );
};

export default CanvasRasterViewport;
