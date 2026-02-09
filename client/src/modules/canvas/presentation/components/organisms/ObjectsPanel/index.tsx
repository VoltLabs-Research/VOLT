import { Layers, SlidersHorizontal, ChevronDown, Atom } from 'lucide-react';
import PanelHeader from '../../atoms/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import IconButton from '@/shared/presentation/components/IconButton';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';
import AnalysisTreeNode from '../../molecules/AnalysisTreeNode';
import './ObjectsPanel.css';

interface ObjectsPanelProps {
    trajectory: Trajectory | null | undefined;
}

const ObjectsPanel = ({ trajectory }: ObjectsPanelProps) => {
    const {
        filteredSections,
        expandedSections,
        toggleSection,
        showSectionsSkeleton,
        activeScene,
        onSelectScene,
        isSceneInActiveScenes,
        addScene,
        removeScene,
        totalAnalyses
    } = useCanvasSidebarState({ trajectory, trajectoryId: trajectory?._id });

    const { statusMap } = useAnalysisStatus({ trajectoryId: trajectory?._id, enabled: !!trajectory?._id });

    const defaultScene = { sceneType: 'trajectory', source: 'default' as const };
    const isDefaultActive = activeScene?.source === 'default';

    return (
        <Container className="canvas-objects-panel d-flex column">
            <PanelHeader
                icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />}
                title="Objects"
                actions={
                    <IconButton variant="ghost" size="sm" aria-label="Filter">
                        <SlidersHorizontal style={{ width: 13, height: 13 }} />
                    </IconButton>
                }
            />

                <Container className="canvas-tree-container overflow-auto" role="tree" aria-label="Scene hierarchy">
                    <Container className="canvas-tree-item canvas-tree-item-root font-size-1 d-flex items-center gap-05 color-secondary u-select-none" role="treeitem">
                        <ChevronDown style={{ width: 13, height: 13, color: 'var(--text-tertiary)' }} />
                        <Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />
                        <span className="color-secondary">Scene Collection</span>
                    </Container>

                <Popover
                    id="canvas-ctx-default-scene"
                    triggerAction="contextmenu"
                    trigger={(
                        <Container
                            className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none ${isDefaultActive ? 'selected' : ''}`}
                            style={{ paddingLeft: 16 }}
                            onClick={() => {
                                onSelectScene(defaultScene);
                            }}
                            role="treeitem"
                            aria-selected={isDefaultActive}
                            tabIndex={0}
                        >
                            <span className="canvas-tree-spacer" />
                            <Atom style={{ width: 13, height: 13, color: '#60a5fa' }} />
                            <span className={`${isDefaultActive ? 'color-primary' : 'color-secondary'}`}>
                                Trajectory
                            </span>
                        </Container>
                    )}
                >
                    <PopoverMenuItem onClick={() => addScene(defaultScene)} disabled={isDefaultActive}>
                        Add to scene
                    </PopoverMenuItem>
                    <PopoverMenuItem onClick={() => removeScene(defaultScene)} disabled={!isDefaultActive}>
                        Remove from scene
                    </PopoverMenuItem>
                </Popover>

                {showSectionsSkeleton && totalAnalyses > 0 && (
                    Array.from({ length: Math.min(totalAnalyses, 3) }).map((_, i) => (
                        <Container key={`skel-${i}`} className="canvas-tree-item d-flex items-center gap-05 color-secondary canvas-tree-item--indent">
                            <span className="canvas-tree-spacer" />
                            <Container className="canvas-tree-skeleton" />
                        </Container>
                    ))
                )}

                {!showSectionsSkeleton && filteredSections.map((section: AnalysisSectionData) => (
                    <AnalysisTreeNode
                        key={section.analysis._id}
                        section={section}
                        effectiveStatus={statusMap.get(section.analysis._id)}
                        isExpanded={expandedSections.has(section.analysis._id)}
                        onToggle={toggleSection}
                        onSelectScene={onSelectScene}
                        isSceneActive={isSceneInActiveScenes}
                        onAddScene={addScene}
                        onRemoveScene={removeScene}
                    />
                ))}

                {!showSectionsSkeleton && totalAnalyses === 0 && (
                    <Container className="p-1 text-center">
                        <Paragraph className="color-muted font-size-1">No analyses available</Paragraph>
                    </Container>
                )}
            </Container>
        </Container>
    );
};

export default ObjectsPanel;
