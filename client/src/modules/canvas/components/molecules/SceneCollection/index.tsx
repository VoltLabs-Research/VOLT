import AnalysisTreeNode from '../../molecules/AnalysisTreeNode';

import { Atom } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import Paragraph from '@/shared/presentation/components/Paragraph';

import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { CanvasAnalysisStatusEntry } from '../../../utilities/analysis-status';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';

interface SceneCollectionProps {
    filteredSections: AnalysisSectionData[];
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    showSectionsSkeleton: boolean;
    activeScene: SceneObjectType | null;
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneInActiveScenes: (scene: SceneObjectType) => boolean;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    totalAnalyses: number;
    statusMap: Map<string, CanvasAnalysisStatusEntry>;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    onDownloadAnalysis: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    showDefaultScene?: boolean;
};

const SceneCollection = ({
    filteredSections,
    expandedSections,
    toggleSection,
    showSectionsSkeleton,
    activeScene,
    onSelectScene,
    isSceneInActiveScenes,
    addScene,
    removeScene,
    totalAnalyses,
    statusMap,
    onDeleteAnalysis,
    onDownloadAnalysis,
    onDownloadExposureListing,
    showDefaultScene = true
}: SceneCollectionProps) => {
    const defaultScene = { sceneType: 'trajectory', source: 'default' as const };
    const isDefaultActive = activeScene?.source === 'default';

    return (
        <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Scene hierarchy">
            {showDefaultScene && (
                <ContextMenuPopover
                    id="canvas-ctx-default-scene"
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
                    options={[
                        {
                            label: 'Add to scene',
                            onClick: () => addScene(defaultScene),
                            disabled: isDefaultActive
                        },
                        {
                            label: 'Remove from scene',
                            onClick: () => removeScene(defaultScene),
                            disabled: !isDefaultActive
                        }
                    ]}
                    size='sm'
                />
            )}

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
                    effectiveStatus={statusMap.get(section.analysis._id)?.status}
                    isExpanded={expandedSections.has(section.analysis._id)}
                    onToggle={toggleSection}
                    onSelectScene={onSelectScene}
                    isSceneActive={isSceneInActiveScenes}
                    onAddScene={addScene}
                    onRemoveScene={removeScene}
                    onDeleteAnalysis={onDeleteAnalysis}
                    onDownloadAnalysis={onDownloadAnalysis}
                    onDownloadExposureListing={onDownloadExposureListing}
                />
            ))}

            {!showSectionsSkeleton && totalAnalyses === 0 && (
                <Container className="p-1 text-center">
                    <Paragraph className="color-muted font-size-1">No analyses available</Paragraph>
                </Container>
            )}
        </Container>
    );
};

export default SceneCollection;
