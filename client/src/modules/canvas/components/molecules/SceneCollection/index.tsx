import AnalysisTreeNode from '../../molecules/AnalysisTreeNode';
import CanvasSlider from '../../atoms/CanvasSlider';
import { resolvePluginSceneRenderMetadata } from '../../../utilities/plugin-exposure-export';
import { isSameScene } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';

import { Atom, Box, Eye, Minus, Plus } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import Paragraph from '@/shared/presentation/components/Paragraph';

import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { CanvasAnalysisStatusEntry } from '../../../utilities/analysis-status';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { RasterSelectableScene } from '@/modules/raster/types/container-selection';

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
    showSimulationCell?: boolean;
    onToggleSimulationCell?: () => void;
    sceneVisualOverrides?: SceneVisualOverrides;
    setSceneOpacity?: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth?: (sceneKey: string, lineWidth: number) => void;
    selectionMode?: 'default' | 'raster';
    selectedScene?: RasterSelectableScene | null;
    onSelectRasterScene?: (scene: RasterSelectableScene, label: string) => void;
};

const TREE_SCENE_ICON_COLOR = 'var(--accent-blue)';

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
    showDefaultScene = true,
    showSimulationCell = true,
    onToggleSimulationCell,
    sceneVisualOverrides = {},
    setSceneOpacity,
    setSceneLineWidth,
    selectionMode = 'default',
    selectedScene,
    onSelectRasterScene
}: SceneCollectionProps) => {
    const { pluginsById } = usePluginSelectors();
    const defaultScene = { sceneType: 'trajectory', source: 'default' as const };
    const isRasterSelectionMode = selectionMode === 'raster';
    const isDefaultActive = isRasterSelectionMode
        ? isSameScene(selectedScene, defaultScene)
        : activeScene?.source === 'default';

    const defaultSceneKey = getSceneKey(defaultScene);
    const defaultOpacity = sceneVisualOverrides[defaultSceneKey]?.opacity ?? 1;

    const defaultTransparencySubmenu = (
        <div className="context-menu-transparency">
            <span className="context-menu-transparency__label">Transparency</span>
            <CanvasSlider
                ariaLabel="Adjust trajectory transparency"
                min={0}
                max={1}
                step={0.01}
                value={defaultOpacity}
                onChange={(value: number) => setSceneOpacity?.(defaultSceneKey, value)}
                ariaValueText={`${Math.round(defaultOpacity * 100)}% opacity`}
            />
        </div>
    );

    const defaultSceneOptions: MenuOption[] = [
        ...(isDefaultActive
            ? [{
                label: 'Remove from scene',
                icon: Minus,
                destructive: true,
                onClick: () => removeScene(defaultScene)
            }]
            : [{
                label: 'Add to scene',
                icon: Plus,
                onClick: () => addScene(defaultScene)
            }]
        ),
        {
            label: 'Transparency',
            icon: Eye,
            submenuContent: defaultTransparencySubmenu
        }
    ];

    const simulationCellKey = 'simulation-cell';
    const simulationCellOpacity = sceneVisualOverrides[simulationCellKey]?.opacity ?? 1;

    const simulationCellTransparencySubmenu = (
        <div className="context-menu-transparency">
            <span className="context-menu-transparency__label">Transparency</span>
            <CanvasSlider
                ariaLabel="Adjust simulation cell transparency"
                min={0}
                max={1}
                step={0.01}
                value={simulationCellOpacity}
                onChange={(value: number) => setSceneOpacity?.(simulationCellKey, value)}
                ariaValueText={`${Math.round(simulationCellOpacity * 100)}% opacity`}
            />
        </div>
    );

    const simulationCellOptions: MenuOption[] = [
        ...(showSimulationCell
            ? [{
                label: 'Remove from scene',
                icon: Minus,
                destructive: true,
                onClick: onToggleSimulationCell
            }]
            : [{
                label: 'Add to scene',
                icon: Plus,
                onClick: onToggleSimulationCell
            }]
        ),
        {
            label: 'Transparency',
            icon: Eye,
            submenuContent: simulationCellTransparencySubmenu
        }
    ];

    return (
        <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Scene hierarchy">
            {showDefaultScene && (
                isRasterSelectionMode ? (
                    <button
                        className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none ${isDefaultActive ? 'selected' : ''}`}
                        style={{ paddingLeft: 16 }}
                        onClick={() => {
                            onSelectRasterScene?.(defaultScene, 'Trajectory');
                        }}
                        role="treeitem"
                        aria-selected={isDefaultActive}
                        type="button"
                    >
                        <span className="canvas-tree-spacer" />
                        <Atom style={{ width: 13, height: 13, color: TREE_SCENE_ICON_COLOR }} />
                        <span className={`${isDefaultActive ? 'color-primary' : 'color-secondary'}`}>
                            Trajectory
                        </span>
                    </button>
                ) : (
                    <ContextMenuPopover
                        id="canvas-ctx-default-scene"
                        trigger={(
                            <button
                                className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none ${isDefaultActive ? 'selected' : ''}`}
                                style={{ paddingLeft: 16 }}
                                onClick={() => {
                                    onSelectScene(defaultScene);
                                }}
                                role="treeitem"
                                aria-selected={isDefaultActive}
                                type="button"
                            >
                                <span className="canvas-tree-spacer" />
                                <Atom style={{ width: 13, height: 13, color: TREE_SCENE_ICON_COLOR }} />
                                <span className={`${isDefaultActive ? 'color-primary' : 'color-secondary'}`}>
                                    Trajectory
                                </span>
                            </button>
                        )}
                        options={defaultSceneOptions}
                        size='sm'
                    />
                )
            )}

            {showDefaultScene && !isRasterSelectionMode && (
                <ContextMenuPopover
                    id="canvas-ctx-simulation-cell"
                    trigger={(
                        <button
                            className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none ${showSimulationCell ? 'selected' : ''}`}
                            style={{ paddingLeft: 16 }}
                            onClick={onToggleSimulationCell}
                            role="treeitem"
                            aria-selected={showSimulationCell}
                            type="button"
                        >
                            <span className="canvas-tree-spacer" />
                            <Box style={{ width: 13, height: 13, color: TREE_SCENE_ICON_COLOR }} />
                            <span className={`${showSimulationCell ? 'color-primary' : 'color-secondary'}`}>
                                Simulation Cell
                            </span>
                        </button>
                    )}
                    options={simulationCellOptions}
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
                    sceneVisualOverrides={sceneVisualOverrides}
                    setSceneOpacity={setSceneOpacity ?? (() => undefined)}
                    setSceneLineWidth={setSceneLineWidth ?? (() => undefined)}
                    resolveSceneRenderMetadata={(pluginId, exposureId) => {
                        return resolvePluginSceneRenderMetadata(pluginsById[pluginId], exposureId);
                    }}
                    selectionMode={selectionMode}
                    selectedScene={selectedScene}
                    onSelectRasterScene={onSelectRasterScene}
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
