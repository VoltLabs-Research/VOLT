import React, { useState, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';

import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import ExposureSkeleton from '@/features/canvas/components/atoms/ExposureSkeleton';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';
import AnalysisTooltipContent from '@/features/canvas/components/molecules/AnalysisTooltipContent';

import ExposureOption from '@/features/canvas/components/molecules/ExposureOption';
import { formatConfigValue, buildArgumentLabelMap } from '@/features/canvas/components/molecules/CanvasSidebarScene/utils';
import { usePluginStore } from '@/features/plugins/stores/plugin-slice';
import { useUIStore } from '@/stores/slices/ui';
import useToast from '@/hooks/ui/use-toast';
import useAnalysisConfigStore from '@/features/analysis/stores';

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
    updateAnalysisConfig: (analysis: any) => void;
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
    updateAnalysisConfig,
    onDelete,
    isInProgress = false
}) => {
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
    const setResultsViewerData = useUIStore((s) => s.setResultsViewerData);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const { showSuccess } = useToast();

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
        updateAnalysisConfig(section.analysis);
    }, [onAddScene, updateAnalysisConfig, section.analysis]);

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
                triggerAction="contextmenu"
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                    <Container
                        className={`analysis-section-header d-flex column ${isInProgress ? 'cursor-progress' : 'cursor-pointer'}`}
                        onClick={() => {
                            onToggle(section.analysis._id);
                        }}
                        onMouseEnter={(e) => {
                            setTooltipOpen(true);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setTooltipOpen(false)}
                    >
                        <Container className='d-flex items-center gap-05'>
                            <i
                                className='analysis-section-arrow font-size-4'
                                onClick={(e) => {
                                    e.stopPropagation();
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
                                        {' • '}{formatDistanceToNow(new Date(section.analysis.createdAt), { addSuffix: true })}
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
                            const allExposures = await usePluginStore.getState().getAllExposures(
                                trajectoryId,
                                section.analysis._id,
                                section.pluginSlug
                            );

                            setResultsViewerData({
                                pluginSlug: section.pluginSlug,
                                pluginName: section.pluginDisplayName,
                                analysisId: section.analysis._id,
                                exposures: allExposures
                            });
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
