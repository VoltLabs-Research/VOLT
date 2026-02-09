import { ChevronDown, ChevronRight, FlaskConical, Atom } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
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
}

const AnalysisTreeNode = ({
    section,
    effectiveStatus,
    isExpanded,
    onToggle,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene
}: AnalysisTreeNodeProps) => {
    const { analysis, pluginDisplayName, entry, isCurrentAnalysis } = section;
    const hasExposures = entry.state === 'loaded' && entry.exposures.length > 0;
    const isLoading = entry.state === 'loading';

    return (
        <>
            <Container
                className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none canvas-tree-item--indent ${isCurrentAnalysis ? 'selected' : ''}`}
                onClick={() => {
                    onToggle(analysis._id);
                    onSelectScene({ sceneType: 'trajectory', source: 'default' as const }, analysis);
                }}
                role="treeitem"
                aria-selected={isCurrentAnalysis}
                tabIndex={0}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(analysis._id);
                    }}
                    className="canvas-tree-toggle b-none p-0"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                    {isExpanded
                        ? <ChevronDown style={{ width: 13, height: 13 }} />
                        : <ChevronRight style={{ width: 13, height: 13 }} />
                    }
                </button>
                <FlaskConical style={{ width: 13, height: 13, color: isCurrentAnalysis ? '#a78bfa' : 'rgba(167, 139, 250, 0.35)' }} />
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
