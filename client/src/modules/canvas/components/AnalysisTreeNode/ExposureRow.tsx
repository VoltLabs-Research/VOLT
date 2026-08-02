import { Download } from 'lucide-react';
import { CanvasTreeRow, MaybeContextMenu } from '../CanvasTree';
import { DEFAULT_LINE_WIDTH, buildPluginScene, buildSceneRenderMetadata } from '../../utils/plugin-exposure-export';
import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { buildArtifactNameClassName, getArtifactIcon } from './artifact-rows';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { isSameScene } from '@/modules/canvas/utils/scene-identity';
import {
    buildAddRemoveOption,
    buildColorSubmenu,
    buildLineWidthSubmenu,
    buildTransparencySubmenu,
    colorOption,
    lineSettingsOption,
    transparencyOption
} from '../../utils/tree-menus';

import type { Analysis, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';
import type { MenuOption } from '@/shared/contracts/menu';
import type { RasterSelectableScene } from '@/modules/raster/contracts/container-selection';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SceneObjectType, SceneRenderMetadata, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';

/**
 * Scene wiring shared by the tree node and the exposure rows it renders.
 */
export interface SceneRowActions {
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneActive: (scene: SceneObjectType) => boolean;
    onAddScene: (scene: SceneObjectType) => void;
    onRemoveScene: (scene: SceneObjectType) => void;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    sceneVisualOverrides: SceneVisualOverrides;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth: (sceneKey: string, lineWidth: number) => void;
    setSceneColor: (sceneKey: string, color: string | undefined) => void;
    resolveSceneRenderMetadata?: (pluginId: string, exposureId: string) => SceneRenderMetadata | undefined;
    selectedScene?: RasterSelectableScene | null;
    onSelectRasterScene?: (scene: RasterSelectableScene, label: string) => void;
}

interface ExposureRowProps extends SceneRowActions {
    analysis: Analysis;
    artifact?: AnalysisExpectedArtifact;
    exposure: RenderableExposure;
    pluginId: string;
    isRecentlyReady: boolean;
    isRasterSelectionMode: boolean;
    tourTargetId?: string;
}

/**
 * Row for a loaded exposure: builds its scene handle and exposes the
 * per-scene visual overrides through the context menu.
 */
const ExposureRow = ({
    analysis,
    artifact,
    exposure,
    pluginId,
    isRecentlyReady,
    isRasterSelectionMode,
    tourTargetId,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene,
    onDownloadExposureListing,
    sceneVisualOverrides,
    setSceneOpacity,
    setSceneLineWidth,
    setSceneColor,
    resolveSceneRenderMetadata,
    selectedScene,
    onSelectRasterScene
}: ExposureRowProps) => {
    const sceneRenderMetadata = buildSceneRenderMetadata(exposure.export)
        ?? resolveSceneRenderMetadata?.(pluginId, exposure.exposureId);
    const scene = buildPluginScene({
        analysisId: exposure.analysisId,
        exposureId: exposure.exposureId,
        sceneRenderMetadata
    });
    const isActive = isRasterSelectionMode
        ? isSameScene(selectedScene, scene)
        : isSceneActive(scene);
    const sceneKey = getSceneKey(scene);
    const sceneOverride = sceneVisualOverrides[sceneKey];
    const isLineExposure = sceneRenderMetadata?.exporter === Exporter.LINE;
    const defaultLineWidth = sceneRenderMetadata?.defaultLineWidth ?? DEFAULT_LINE_WIDTH;

    const exposureMenuOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive,
            onAdd: () => onAddScene(scene),
            onRemove: () => onRemoveScene(scene)
        }),
        {
            label: 'Download',
            icon: Download,
            onClick: () => {
                onDownloadExposureListing?.({
                    pluginId,
                    exposureId: exposure.exposureId,
                    analysisId: analysis._id,
                    exposureName: exposure.name
                });
            }
        },
        transparencyOption(buildTransparencySubmenu(sceneOverride?.opacity ?? 1, (value) => setSceneOpacity(sceneKey, value))),
        colorOption(buildColorSubmenu(sceneOverride?.color, (value) => setSceneColor(sceneKey, value))),
        ...(isLineExposure
            ? [lineSettingsOption(buildLineWidthSubmenu(sceneOverride?.lineWidth ?? defaultLineWidth, defaultLineWidth, (value) => setSceneLineWidth(sceneKey, value)))]
            : [])
    ];

    return (
        <MaybeContextMenu
            enabled={!isRasterSelectionMode}
            id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
            options={exposureMenuOptions}
        >
            <CanvasTreeRow
                indent='lg'
                isActive={isActive}
                icon={getArtifactIcon('ready')}
                label={(
                    <span className={buildArtifactNameClassName(artifact, isRecentlyReady)}>
                        <span className='truncate'>{exposure.name}</span>
                    </span>
                )}
                onClick={() => {
                    if (isRasterSelectionMode) {
                        onSelectRasterScene?.(scene, exposure.name);
                        return;
                    }
                    onSelectScene(scene, analysis);
                }}
                tourTargetId={tourTargetId}
            />
        </MaybeContextMenu>
    );
};

export default ExposureRow;
