import React, { useState, useMemo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';

import Container from '@/shared/presentation/components/primitives/Container';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Popover from '@/shared/presentation/components/molecules/common/Popover';
import PopoverMenuItem from '@/shared/presentation/components/atoms/common/PopoverMenuItem';
import ExposureSkeleton from '@/modules/canvas/presentation/components/atoms/ExposureSkeleton';
import CursorTooltip from '@/shared/presentation/components/atoms/common/CursorTooltip';
import AnalysisTooltipContent from '@/modules/canvas/presentation/components/molecules/AnalysisTooltipContent';

import ExposureOption from '@/modules/canvas/presentation/components/molecules/ExposureOption';
import { formatConfigValue, buildArgumentLabelMap } from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/utils';
import { usePluginExposures } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import { useToast } from '@/shared/presentation/hooks/ui/use-toast';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';

interface AnalysisSectionProps {
    analysis: any;
    pluginSlug: string;
    pluginDisplayName: string;
    isCurrentAnalysis: boolean;
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
    updateAnalysisConfig: (analysis: any) => void;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
    analysis,
    pluginSlug,
    pluginDisplayName,
    isCurrentAnalysis,
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
    const setResultsViewerData = useUIStore((s) => s.setResultsViewerData);
    const analysisConfig = useAnalysisStore((state) => state.analysisConfig);
    const { showSuccess } = useToast();

    // Use the hook to fetch exposures when expanded
    const { exposures, plugin, isLoading, error } = usePluginExposures({
        analysisId: analysis._id,
        pluginSlug,
        context: 'canvas'
    });

    const labelMap = useMemo(() => {
        const getPluginArguments = () => (plugin?.arguments ?? []) as any[];
        return buildArgumentLabelMap(pluginSlug, getPluginArguments);
    }, [plugin, pluginSlug]);

    const configDescription = useMemo(() => {
        return differingFields
            .map(([key, value]) => `${labelMap.get(key) || key}: ${formatConfigValue(value)}`)
            .join(', ');
    }, [differingFields, labelMap]);

    const handleHeaderPopoverChange = useCallback((isOpen: boolean) => {
        const callback = headerPopoverCallbacks.get(analysis._id);
        if (callback) callback(isOpen);
    }, [headerPopoverCallbacks, analysis._id]);

    return (
        <Container className='analysis-section overflow-hidden'>
            <Popover
                id={`analysis-header-menu-${analysis._id}`}
                triggerAction="contextmenu"
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                    <Container
                        className='analysis-section-header d-flex column cursor-pointer'
                        onClick={() => {
                            onToggle(analysis._id);
                            if (analysisConfig?._id === analysis._id) {
                                return;
                            }
                            updateAnalysisConfig(analysis);
                            showSuccess(`${pluginDisplayName} (${formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}) selected sucessfully! `);
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
                                    onToggle(analysis._id);
                                }}
                            >
                                {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                            </i>

                            <Paragraph
                                className={`analysis-section-title font-size-2 ${isCurrentAnalysis ? 'color-gray' : 'color-secondary'} overflow-hidden font-weight-5`}
                            >
                                {pluginDisplayName}
                                {isCurrentAnalysis && ' (Active)'}
                                {analysis?.createdAt && (
                                    <span className='analysis-section-date font-weight-4'>
                                        {' • '}{formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
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
                    isLoading={detailsLoading || !plugin}
                    onClick={async () => {
                        if (!trajectoryId || !plugin) return;
                        setDetailsLoading(true);
                        try {
                            const allExposures = (plugin?.exposures || []).map((exposure: any) => ({
                                pluginId: plugin._id,
                                pluginSlug: plugin.slug,
                                analysisId: analysis._id,
                                exposureId: exposure._id,
                                modifierId: plugin.slug,
                                name: exposure.name,
                                icon: exposure.icon,
                                results: exposure.results,
                                canvas: exposure.canvas,
                                raster: exposure.raster,
                                perAtomProperties: exposure.perAtomProperties,
                                export: exposure.export
                            }));

                            setResultsViewerData({
                                pluginSlug: pluginSlug,
                                pluginName: pluginDisplayName,
                                analysisId: analysis._id,
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

            {isExpanded && isLoading && (
                <Container className='analysis-section-content'>
                    <ExposureSkeleton count={3} compact />
                </Container>
            )}

            {isExpanded && error && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                    Failed to load visualizers
                </Paragraph>
            )}

            {isExpanded && !isLoading && exposures.length > 0 && (
                <Container className='analysis-section-content d-flex column gap-05'>
                    {exposures.map((exposure: any, index: number) => (
                        <ExposureOption
                            key={`${exposure.exposureId}-${index}`}
                            exposure={exposure}
                            analysisId={analysis._id}
                            index={index}
                            onSelect={(scene) => {
                                updateAnalysisConfig(analysis);
                                onSelectScene(scene);
                            }}
                            onAdd={(scene) => {
                                updateAnalysisConfig(analysis);
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

            {isExpanded && !isLoading && exposures.length === 0 && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                    No visualizations available
                </Paragraph>
            )}

            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={<AnalysisTooltipContent analysis={analysis} />}
            />
        </Container>
    );
};

export default React.memo(AnalysisSection);
