import AnalysisTreeNode from '../AnalysisTreeNode';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { resolvePluginSceneRenderMetadata } from '../../utils/plugin-exposure-export';
import { isSameScene } from '@/modules/canvas/utils/scene-identity';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    CanvasTreeRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../CanvasTree';
import {
    buildAddRemoveOption,
    buildColorSubmenu,
    buildTransparencySubmenu,
    colorOption,
    transparencyOption
} from '../../utils/tree-menus';

import { Atom, Box } from 'lucide-react';
import { Stack } from '@voltstack/bravais';
import type { AnalysisSectionData } from '../../hooks/use-canvas-sidebar-scene';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { CanvasAnalysisStatusEntry } from '../../utils/analysis-status';
import type { AnalysisActivityTone } from '../../hooks/use-analysis-activity-tone';
import type { MenuOption } from '@/shared/contracts/menu';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import type { RasterSelectableScene } from '@/modules/raster/contracts/container-selection';

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
    toneByAnalysisId?: Map<string, AnalysisActivityTone>;
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
    setSceneColor?: (sceneKey: string, color: string | undefined) => void;
    selectionMode?: 'default' | 'raster';
    selectedScene?: RasterSelectableScene | null;
    onSelectRasterScene?: (scene: RasterSelectableScene, label: string) => void;
    firstAnalysisTourTargetId?: string;
    firstExposureTourTargetId?: string;
}

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
    toneByAnalysisId,
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
    setSceneColor,
    selectionMode = 'default',
    selectedScene,
    onSelectRasterScene,
    firstAnalysisTourTargetId,
    firstExposureTourTargetId
}: SceneCollectionProps) => {
    const { pluginsById } = usePluginSelectors();
    const defaultScene = {
        sceneType: 'trajectory',
        source: 'default' as const
    };
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
        transparencyOption(buildTransparencySubmenu(defaultOpacity, (value: number) => setSceneOpacity?.(defaultSceneKey, value))),
        colorOption(buildColorSubmenu(sceneVisualOverrides[defaultSceneKey]?.color, (value) => setSceneColor?.(defaultSceneKey, value)))
    ];

    const simulationCellOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive: !!showSimulationCell,
            onAdd: () => onToggleSimulationCell?.(),
            onRemove: () => onToggleSimulationCell?.()
        }),
        transparencyOption(buildTransparencySubmenu(simulationCellOpacity, (value: number) => setSceneOpacity?.(simulationCellKey, value)))
    ];

    const trajectoryRow = (
        <CanvasTreeRow
            isActive={!!isDefaultActive}
            icon={<Atom style={{
                width: 13,
                height: 13,
                color: TREE_SCENE_ICON_COLOR
            }} />}
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
            icon={<Box style={{
                width: 13,
                height: 13,
                color: TREE_SCENE_ICON_COLOR
            }} />}
            label='Simulation Cell'
            onClick={onToggleSimulationCell}
        />
    );

    return (
        <Stack gap='025' overflow='auto' className="canvas-tree-container" role="tree" aria-label="Scene hierarchy">
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

            {!showSectionsSkeleton && filteredSections.map((section: AnalysisSectionData, index) => (
                <AnalysisTreeNode
                    key={section.analysis._id}
                    section={section}
                    status={statusMap.get(section.analysis._id)?.status}
                    tone={toneByAnalysisId?.get(section.analysis._id)}
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
                    setSceneColor={setSceneColor ?? (() => undefined)}
                    resolveSceneRenderMetadata={(pluginId, exposureId) => {
                        return resolvePluginSceneRenderMetadata(pluginsById[pluginId], exposureId);
                    }}
                    plugin={pluginsById[resolveAnalysisPluginId(section.analysis)]}
                    pluginsById={pluginsById}
                    selectionMode={selectionMode}
                    selectedScene={selectedScene}
                    onSelectRasterScene={onSelectRasterScene}
                    tourTargetId={index === 0 ? firstAnalysisTourTargetId : undefined}
                    firstExposureTourTargetId={index === 0 ? firstExposureTourTargetId : undefined}
                />
            ))}
        </Stack>
    );
};

export default SceneCollection;
