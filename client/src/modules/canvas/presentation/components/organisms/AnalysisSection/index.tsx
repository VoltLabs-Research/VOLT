import React, { useState, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';

import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import ExposureSkeleton from '@/modules/canvas/presentation/components/atoms/ExposureSkeleton';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';
import AnalysisTooltipContent from '@/modules/canvas/presentation/components/molecules/AnalysisTooltipContent';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';

import ExposureOption from '@/modules/canvas/presentation/components/molecules/ExposureOption';
import { formatConfigValue, buildArgumentLabelMap } from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/utils';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';

interface AnalysisSectionProps {
    section: any;
    trajectoryId: string;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    differingFields: [string, any][];
    headerPopoverCallbacks: Map<string, (isOpen: boolean) => void>;
    headerPopoverStates: Map<string, boolean>;
    onSelectScene: (scene: any, analysis?: any) => void;
    onAddScene: (scene: any) => void;
    onRemoveScene: (scene: any) => void;
    isSceneActive: (scene: any) => boolean;
    activeScene: any;
    onDelete: (analysisId: string) => void;
    isInProgress?: boolean;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
    section,
    trajectoryId,
    isExpanded,
    onToggle,
    differingFields,
    headerPopoverCallbacks,
    onSelectScene,
    onAddScene,
    onRemoveScene,
    isSceneActive,
    activeScene,
    onDelete,
    isInProgress = false
}) => {
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
    const { setAnalysisId, setResultsSlug } = useCanvasUrlState();

    const handleHeaderPopoverChange = headerPopoverCallbacks.get(section.analysis._id)!;

    const labelMap = buildArgumentLabelMap(section.pluginSlug, getPluginArguments);
    const configDescription = differingFields
        .map(([key, value]) => `${labelMap.get(key) || key}: ${formatConfigValue(value)}`)
        .join(', ');

    const handleExposureSelect = useCallback((scene: any) => {
        onSelectScene(scene, section.analysis);
    }, [onSelectScene, section.analysis]);

    const handleExposureAdd = useCallback((scene: any) => {
        onAddScene(scene);
        setAnalysisId(section.analysis._id, { replace: true });
    }, [onAddScene, section.analysis, setAnalysisId]);

    const entry = section.entry;
    const isLoaded = entry.state === 'loaded';

    const activeStates = useMemo(() => {
        const map = new Map<string, boolean>();
        if (entry.state === 'loaded') {
            entry.exposures.forEach((exposure: any) => {
                const key = `${exposure.analysisId}-${exposure.exposureId}`;
                map.set(key, isSceneActive({
                    sceneType: exposure.exposureId,
                    source: 'plugin',
                    analysisId: exposure.analysisId,
                    exposureId: exposure.exposureId
                }));
            });
        }
        return map;
    }, [entry.state, entry.exposures, isSceneActive]);

    const isExposureSelected = useCallback((exposure: any) => {
        if (!activeScene || activeScene.source !== 'plugin') return false;
        return activeScene.analysisId === exposure.analysisId &&
            activeScene.exposureId === exposure.exposureId;
    }, [activeScene]);

    return (
        <Container className='analysis-section overflow-hidden'>
            <Popover
                id={`analysis-header-menu-${section.analysis._id}`}
                triggerAction='contextmenu'
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                    <Container
                        className={`analysis-section-header d-flex column ${isInProgress ? 'cursor-progress' : 'cursor-pointer'}`}
                        onClick={() => {
                            if (isInProgress) return;
                            onToggle(section.analysis._id);
                        }}
                        onContextMenu={(event) => {
                            if (isInProgress) {
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        }}
                        onMouseEnter={(event) => {
                            setTooltipOpen(true);
                            setTooltipPos({ x: event.clientX, y: event.clientY });
                        }}
                        onMouseMove={(event) => {
                            setTooltipPos({ x: event.clientX, y: event.clientY });
                        }}
                        onMouseLeave={() => setTooltipOpen(false)}
                    >
                        <Container className='d-flex items-center gap-05'>
                            <i
                                className='analysis-section-arrow d-flex items-center content-center font-size-4'
                                onClick={(event) => {
                                    event.stopPropagation();
                                    if (isInProgress) return;
                                    onToggle(section.analysis._id);
                                }}
                            >
                                {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                            </i>

                            <Paragraph
                                className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-gray' : 'color-secondary'} overflow-hidden font-weight-5`}
                            >
                                {section.pluginDisplayName}
                                {section.isCurrentAnalysis && ' (Active)'}
                                {section.analysis?.createdAt && (
                                    <span className='analysis-section-date font-weight-4'>
                                        {' - '}{formatDistanceToNow(new Date(section.analysis.createdAt), { addSuffix: true })}
                                    </span>
                                )}
                            </Paragraph>
                        </Container>

                        {configDescription && (
                            <Paragraph className='analysis-section-description color-tertiary font-size-1 w-max overflow-hidden'>
                                {configDescription}
                            </Paragraph>
                        )}
                    </Container>
                }
            >
                <PopoverMenuItem
                    isLoading={detailsLoading}
                    onClick={async () => {
                        if (!trajectoryId) return;
                        setDetailsLoading(true);
                        try {
                            setResultsSlug(section.pluginSlug, { replace: true });
                            setAnalysisId(section.analysis._id, { replace: true });
                        } finally {
                            setDetailsLoading(false);
                        }
                    }}
                >
                    View details
                </PopoverMenuItem>
                <PopoverMenuItem
                    isLoading={deleteLoading}
                    onClick={async () => {
                        setDeleteLoading(true);
                        try {
                            await onDelete(section.analysis._id);
                        } finally {
                            setDeleteLoading(false);
                        }
                    }}
                >
                    Delete
                </PopoverMenuItem>
            </Popover>

            {isExpanded && !isLoaded && (
                <Container className='analysis-section-content'>
                    <ExposureSkeleton count={3} compact />
                </Container>
            )}

            {isExpanded && entry.state === 'error' && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                    Failed to load visualizers
                </Paragraph>
            )}

            {isExpanded && isLoaded && entry.exposures.length > 0 && (
                <Container className='analysis-section-content d-flex column gap-05'>
                    {entry.exposures.map((exposure: any, index: number) => (
                        <ExposureOption
                            key={`${exposure.exposureId}-${index}`}
                            exposure={exposure}
                            analysisId={section.analysis._id}
                            index={index}
                            onSelect={handleExposureSelect}
                            onAdd={handleExposureAdd}
                            onRemove={onRemoveScene}
                            isActive={activeStates.get(`${exposure.analysisId}-${exposure.exposureId}`) ?? false}
                            isSelected={isExposureSelected(exposure)}
                            isInProgress={isInProgress}
                        />
                    ))}
                </Container>
            )}

            {isExpanded && isLoaded && entry.exposures.length === 0 && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                    No visualizations available
                </Paragraph>
            )}

            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={<AnalysisTooltipContent analysis={section} />}
            />
        </Container>
    );
};

export default React.memo(AnalysisSection);
