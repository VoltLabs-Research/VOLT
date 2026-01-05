import React, { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';

import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import ExposureSkeleton from '@/components/atoms/scene/ExposureSkeleton';

import ExposureOption from '@/components/molecules/scene/ExposureOption';
import { formatConfigValue, buildArgumentLabelMap } from '@/components/molecules/scene/CanvasSidebarScene/utils';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useUIStore } from '@/stores/slices/ui';

interface AnalysisSectionProps {
    section: any;
    trajectoryId: string;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    differingFields: [string, any][];
    headerPopoverCallbacks: Map<string, (isOpen: boolean) => void>; // Callback map
    headerPopoverStates: Map<string, boolean>; // State map
    setTooltip: (open: boolean, pos: { x: number, y: number }, content: any | null) => void;
    onSelectScene: (scene: any, analysis?: any) => void;
    onAddScene: (scene: any) => void;
    onRemoveScene: (scene: any) => void;
    isSceneActive: (scene: any) => boolean;
    updateAnalysisConfig: (analysis: any) => void;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
    section,
    trajectoryId,
    isExpanded,
    onToggle,
    differingFields,
    headerPopoverCallbacks,
    headerPopoverStates,
    setTooltip,
    onSelectScene,
    onAddScene,
    onRemoveScene,
    isSceneActive,
    updateAnalysisConfig
}) => {
    const [detailsLoading, setDetailsLoading] = useState(false);
    const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
    const setResultsViewerData = useUIStore((s) => s.setResultsViewerData);

    const headerPopoverOpen = headerPopoverStates.get(section.analysis._id) || false;
    const handleHeaderPopoverChange = headerPopoverCallbacks.get(section.analysis._id)!;

    const labelMap = buildArgumentLabelMap(section.pluginSlug, getPluginArguments);
    const configDescription = differingFields
        .map(([key, value]) => `${labelMap.get(key) || key}: ${formatConfigValue(value)}`)
        .join(', ');

    const entry = section.entry;
    const isLoaded = entry.state === 'loaded';

    const handleMouseEnter = (e: React.MouseEvent) => {
        if (headerPopoverOpen) return;
        const rect = (e.currentTarget as Element).getBoundingClientRect();

        const durationMs = section.analysis.finishedAt && section.analysis.startedAt
            ? new Date(section.analysis.finishedAt).getTime() - new Date(section.analysis.startedAt).getTime()
            : null;

        setTooltip(true, { x: rect.left + rect.width / 2, y: rect.top }, { ...section, duration: durationMs });
    };

    const handleMouseLeave = () => {
        if (!headerPopoverOpen) {
            setTooltip(false, { x: 0, y: 0 }, null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!headerPopoverOpen) setTooltip(true, { x: e.clientX, y: e.clientY }, null); // Content update usually not needed for move unless pos changes
        // Wait, the parent implementation updated pos on move.
        // We should probably just pass the pos update up.
    };

    return (
        <Container className='analysis-section'>
            <Popover
                id={`analysis-header-menu-${section.analysis._id}`}
                triggerAction="contextmenu"
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                    <Container
                        className='analysis-section-header d-flex column cursor-pointer'
                        onClick={() => onToggle(section.analysis._id)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={(e) => {
                            // If we pass generic "update pos" callback
                            if (!headerPopoverOpen) setTooltip(true, { x: e.clientX, y: e.clientY }, undefined); // undefined content means keep existing
                        }}
                    >
                        <Container className='d-flex items-center gap-05'>
                            <i
                                className='analysis-section-arrow'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(section.analysis._id);
                                }}
                            >
                                {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                            </i>

                            <Paragraph
                                className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-gray' : 'color-secondary'}`}
                            >
                                {section.pluginDisplayName}
                                {section.isCurrentAnalysis && ' (Active)'}
                                {section.analysis?.createdAt && (
                                    <span className='analysis-section-date'>
                                        {' • '}{formatDistanceToNow(new Date(section.analysis.createdAt), { addSuffix: true })}
                                    </span>
                                )}
                            </Paragraph>
                        </Container>

                        {configDescription && (
                            <Paragraph className='analysis-section-description color-tertiary font-size-1'>
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
                            onSelect={(scene) => {
                                updateAnalysisConfig(section.analysis);
                                onSelectScene(scene);
                            }}
                            onAdd={(scene) => {
                                updateAnalysisConfig(section.analysis);
                                onAddScene(scene);
                            }}
                            onRemove={onRemoveScene}
                            isActive={isSceneActive({
                                sceneType: exposure.exposureId,
                                source: 'plugin',
                                analysisId: exposure.analysisId,
                                exposureId: exposure.exposureId
                            })}
                        />
                    ))}
                </Container>
            )}

            {isExpanded && isLoaded && entry.exposures.length === 0 && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                    No visualizations available
                </Paragraph>
            )}
        </Container>
    );
};

export default React.memo(AnalysisSection);
