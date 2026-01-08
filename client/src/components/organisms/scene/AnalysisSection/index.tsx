import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';

import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import ExposureSkeleton from '@/components/atoms/scene/ExposureSkeleton';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';
import AnalysisTooltipContent from '@/components/molecules/scene/AnalysisTooltipContent';

import ExposureOption from '@/components/molecules/scene/ExposureOption';
import { formatConfigValue, buildArgumentLabelMap } from '@/components/molecules/scene/CanvasSidebarScene/utils';
import { usePluginStore } from '@/stores/slices/plugin/plugin-slice';
import { useUIStore } from '@/stores/slices/ui';
import useToast from '@/hooks/ui/use-toast';
import useAnalysisConfigStore from '@/stores/slices/analysis';

interface AnalysisSectionProps {
    section: any;
    trajectoryId: string;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    differingFields: [string, any][];
    headerPopoverCallbacks: Map<string, (isOpen: boolean) => void>; // Callback map
    headerPopoverStates: Map<string, boolean>; // State map
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
    onSelectScene,
    onAddScene,
    onRemoveScene,
    isSceneActive,
    updateAnalysisConfig
}) => {
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

    const entry = section.entry;
    const isLoaded = entry.state === 'loaded';

    return (
        <Container className='analysis-section overflow-hidden'>
            <Popover
                id={`analysis-header-menu-${section.analysis._id}`}
                triggerAction="contextmenu"
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                    <Container
                        className='analysis-section-header d-flex column cursor-pointer'
                        onClick={() => {
                            onToggle(section.analysis._id);
                            if (analysisConfig._id === section.analysis._id) {
                                return;
                            }
                            updateAnalysisConfig(section.analysis);
                            showSuccess(`${section.pluginDisplayName} (${formatDistanceToNow(section.analysis.createdAt, { addSuffix: true })}) selected sucessfully! `);
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
