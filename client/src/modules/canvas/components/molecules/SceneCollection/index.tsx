import AnalysisTreeNode from '../../molecules/AnalysisTreeNode';
import { resolvePluginSceneRenderMetadata } from '../../../utilities/plugin-exposure-export';
import { isSameScene } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    CanvasTreeEmptyRow,
    CanvasTreeRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../../atoms/CanvasTree';
import {
    buildAddRemoveOption,
    buildTransparencySubmenu,
    transparencyOption
} from '../../../utilities/tree-menus';

import { Atom, Box } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';

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
    onRetryLoadExposures?: (analysisId: string) => void;
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
    onRetryLoadExposures,
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
    const simulationCellKey = 'simulation-cell';
    const simulationCellOpacity = sceneVisualOverrides[simulationCellKey]?.opacity ?? 1;

    const defaultSceneOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive: !!isDefaultActive,
            onAdd: () => addScene(defaultScene),
            onRemove: () => removeScene(defaultScene)
        }),
        transparencyOption(buildTransparencySubmenu('trajectory', defaultOpacity, (value) => setSceneOpacity?.(defaultSceneKey, value)))
    ];

    const simulationCellOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive: !!showSimulationCell,
            onAdd: () => onToggleSimulationCell?.(),
            onRemove: () => onToggleSimulationCell?.()
        }),
        transparencyOption(buildTransparencySubmenu('simulation cell', simulationCellOpacity, (value) => setSceneOpacity?.(simulationCellKey, value)))
    ];

    const trajectoryRow = (
        <CanvasTreeRow
            isActive={!!isDefaultActive}
            icon={<Atom style={{ width: 13, height: 13, color: TREE_SCENE_ICON_COLOR }} />}
            label='Trajectory'
            onClick={() => {
                if (isRasterSelectionMode) {
                    onSelectRasterScene?.(defaultScene, 'Trajectory');
                } else {
                    onSelectScene(defaultScene);
                }
            }}
        />
    );

    const simulationCellRow = (
        <CanvasTreeRow
            isActive={showSimulationCell}
            icon={<Box style={{ width: 13, height: 13, color: TREE_SCENE_ICON_COLOR }} />}
            label='Simulation Cell'
            onClick={onToggleSimulationCell}
        />
    );

    return (
        <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Scene hierarchy">
            {showDefaultScene && (
                <MaybeContextMenu enabled={!isRasterSelectionMode} id='canvas-ctx-default-scene' options={defaultSceneOptions}>
                    {trajectoryRow}
                </MaybeContextMenu>
            )}

            {showDefaultScene && !isRasterSelectionMode && (
                <MaybeContextMenu enabled={true} id='canvas-ctx-simulation-cell' options={simulationCellOptions}>
                    {simulationCellRow}
                </MaybeContextMenu>
            )}

            {showSectionsSkeleton && (
                <CanvasTreeSkeletonRows count={Math.min(Math.max(totalAnalyses, 1), 3)} />
            )}

            {!showSectionsSkeleton && filteredSections.map((section: AnalysisSectionData) => (
                <AnalysisTreeNode
                    key={section.analysis._id}
                    section={section}
                    status={statusMap.get(section.analysis._id)?.status}
                    isExpanded={expandedSections.has(section.analysis._id)}
                    onToggle={toggleSection}
                    onSelectScene={onSelectScene}
                    isSceneActive={isSceneInActiveScenes}
                    onAddScene={addScene}
                    onRemoveScene={removeScene}
                    onDeleteAnalysis={onDeleteAnalysis}
                    onDownloadAnalysis={onDownloadAnalysis}
                    onDownloadExposureListing={onDownloadExposureListing}
                    onRetryLoadExposures={onRetryLoadExposures}
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
                <CanvasTreeEmptyRow label='No analyses available' />
            )}
        </Container>
    );
};

export default SceneCollection;
