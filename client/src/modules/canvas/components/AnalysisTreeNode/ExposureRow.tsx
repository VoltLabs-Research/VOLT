import { Download } from 'lucide-react';
import { CanvasTreeRow, MaybeContextMenu } from '../CanvasTree';
import { DEFAULT_LINE_WIDTH, buildPluginScene, buildSceneRenderMetadata } from '../../utils/plugin-exposure-export';
import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { cn } from '@heroui/react';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { isSameScene } from '@/modules/canvas/utils/scene-identity';
import {
    buildAddRemoveOption,
    buildColorSubmenu,
    buildEdgesOption,
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
    setSceneEdges: (sceneKey: string, edges: boolean) => void;
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
    setSceneEdges,
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
    const isMeshExposure = sceneRenderMetadata?.exporter === Exporter.MESH;
    const defaultLineWidth = sceneRenderMetadata?.defaultLineWidth ?? DEFAULT_LINE_WIDTH;

    const labelToneClass = {
        pending: '[&>.truncate]:text-warning [[data-theme=light]_&]:[&>.truncate]:text-[#8a5300]',
        generating: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
        uploading: '[&>.truncate]:text-accent [[data-theme=light]_&]:[&>.truncate]:text-[#0a5fbf]',
        'ready-recent': '[&>.truncate]:text-success [&>.truncate]:[text-shadow:0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)] [[data-theme=light]_&]:[&>.truncate]:text-[#0f7a34]',
        failed: '[&>.truncate]:text-danger [[data-theme=light]_&]:[&>.truncate]:text-[#c41e1e]'
    } as const;

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
            : []),
        ...(isMeshExposure
            ? [buildEdgesOption(sceneOverride?.edges ?? false, () => setSceneEdges(sceneKey, !(sceneOverride?.edges ?? false)))]
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
                label={(
                    <span className={cn(
                        'flex w-full min-w-0 items-center gap-1.5 [&>.truncate]:min-w-0 [&>.truncate]:transition-[color,text-shadow] [&>.truncate]:duration-[180ms]',
                        isRecentlyReady
                            ? labelToneClass['ready-recent']
                            : artifact && artifact.status !== 'ready' && labelToneClass[artifact.status]
                    )}>
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
