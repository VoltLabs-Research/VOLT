import { ChevronDown, ChevronRight, FlaskConical, Atom } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Tooltip from '@/shared/presentation/components/Tooltip';
import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';

interface AnalysisTreeNodeProps {
    section: AnalysisSectionData;
    effectiveStatus?: string;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onSelectScene: (scene: any, analysis?: any) => void;
    isSceneActive: (scene: any) => boolean;
    onAddScene: (scene: any) => void;
    onRemoveScene: (scene: any) => void;
    onDownloadExposureListing?: (params: {
        pluginSlug: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        listingSlug?: string;
    }) => void;
}

const AnalysisTreeNode = ({
    section,
    effectiveStatus,
    isExpanded,
    onToggle,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene,
    onDownloadExposureListing
}: AnalysisTreeNodeProps) => {
    const { analysis, pluginDisplayName, entry, isCurrentAnalysis } = section;
    const hasExposures = entry.state === 'loaded' && entry.exposures.length > 0;
    const isLoading = entry.state === 'loading';
    const isAnalysisInProgress = effectiveStatus === 'running' || effectiveStatus === 'pending';

    return (
        <>
            <Tooltip content='Analysis still running. Options will be available when it finishes.' disabled={!isAnalysisInProgress} placement='bottom'>
                <Container
                    className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none canvas-tree-item--indent ${isCurrentAnalysis ? 'selected' : ''} ${isAnalysisInProgress ? 'is-disabled' : 'cursor-pointer'}`}
                    onClick={() => {
                        if (isAnalysisInProgress) return;
                        onToggle(analysis._id);
                        onSelectScene({ sceneType: 'trajectory', source: 'default' as const }, analysis);
                    }}
                    role="treeitem"
                    aria-selected={isCurrentAnalysis}
                    aria-disabled={isAnalysisInProgress}
                    tabIndex={isAnalysisInProgress ? -1 : 0}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            if (isAnalysisInProgress) return;
                            e.stopPropagation();
                            onToggle(analysis._id);
                        }}
                        className="canvas-tree-toggle b-none p-0"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        disabled={isAnalysisInProgress}
                    >
                        {isExpanded
                            ? <ChevronDown style={{ width: 13, height: 13 }} />
                            : <ChevronRight style={{ width: 13, height: 13 }} />
                        }
                    </button>
                    <FlaskConical style={{ width: 13, height: 13, color: isCurrentAnalysis ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.3)' }} />
                    <span className={`${isCurrentAnalysis ? 'color-primary' : 'color-secondary'}`}>
                        {pluginDisplayName}
                    </span>
                    <span className="flex-1" />
                    {effectiveStatus && effectiveStatus !== 'idle' && (
                        <span className={`canvas-tree-status-dot canvas-tree-status-dot--${effectiveStatus} font-size-05`}>
                            ●
                        </span>
                    )}
                </Container>
            </Tooltip>

            {isExpanded && isLoading && (
                <Container className="canvas-tree-item d-flex items-center gap-05 color-secondary canvas-tree-item--indent-lg">
                    <Container className="canvas-tree-skeleton canvas-tree-skeleton--compact" />
                </Container>
            )}

            {isExpanded && hasExposures && entry.exposures.map((exposure: { exposureId: string; analysisId: string; name: string }) => {
                const scene = {
                    sceneType: exposure.exposureId,
                    source: 'plugin' as const,
                    analysisId: exposure.analysisId,
                    exposureId: exposure.exposureId
                };
                const isActive = isSceneActive(scene);

                return (
                    <Popover
                        key={exposure.exposureId}
                        id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
                        triggerAction="contextmenu"
                        trigger={(
                            <Container
                                className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none canvas-tree-item--indent-lg ${isActive ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelectScene(scene, analysis);
                                }}
                                role="treeitem"
                                aria-selected={isActive}
                                tabIndex={0}
                            >
                                <span className="canvas-tree-spacer" />
                                <Atom style={{ width: 12, height: 12, color: '#60a5fa' }} />
                                <span className={`${isActive ? 'color-primary' : 'color-secondary'}`}>
                                    {exposure.name}
                                </span>
                            </Container>
                        )}
                    >
                        <PopoverMenuItem onClick={() => onAddScene(scene)} disabled={isActive}>
                            Add to scene
                        </PopoverMenuItem>
                        <PopoverMenuItem onClick={() => onRemoveScene(scene)} disabled={!isActive}>
                            Remove from scene
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            label="Download"
                            onClick={() => {
                                onDownloadExposureListing?.({
                                    pluginSlug: section.pluginSlug,
                                    exposureId: exposure.exposureId,
                                    analysisId: analysis._id,
                                    listingSlug: exposure.name
                                });
                            }}
                        />
                    </Popover>
                );
            })}

            {isExpanded && entry.state === 'loaded' && entry.exposures.length === 0 && (
                <Container className="canvas-tree-item d-flex items-center gap-05 color-secondary canvas-tree-item--indent-lg">
                    <span className="color-muted font-size-1">No models</span>
                </Container>
            )}
        </>
    );
};

export default AnalysisTreeNode;
