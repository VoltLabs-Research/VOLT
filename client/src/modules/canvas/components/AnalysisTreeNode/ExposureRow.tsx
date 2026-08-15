import { Download } from 'lucide-react';
import { CanvasTreeRow, MaybeContextMenu } from '../CanvasTree';
import { DEFAULT_LINE_WIDTH, buildPluginScene, buildSceneRenderMetadata } from '../../utils/plugin-exposure-export';
import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { cn } from '@heroui/react';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import useDownloadExposureListing from '../../hooks/use-download-exposure-listing';
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
import type { CanvasTreeIndent } from '../CanvasTree';
import type { MenuOption } from '@/shared/contracts/menu';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SceneObjectType, SceneRenderMetadata, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';

export interface SceneRowActions {
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneActive: (scene: SceneObjectType) => boolean;
    onAddScene: (scene: SceneObjectType) => void;
    onRemoveScene: (scene: SceneObjectType) => void;
    sceneVisualOverrides: SceneVisualOverrides;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth: (sceneKey: string, lineWidth: number) => void;
    setSceneColor: (sceneKey: string, color: string | undefined) => void;
    setSceneEdges: (sceneKey: string, edges: boolean) => void;
    resolveSceneRenderMetadata?: (pluginId: string, exposureId: string) => SceneRenderMetadata | undefined;
}

interface ExposureRowProps extends SceneRowActions {
    analysis: Analysis;
    artifact?: AnalysisExpectedArtifact;
    exposure: RenderableExposure;
    pluginId: string;
    isRecentlyReady: boolean;
    tourTargetId?: string;
    indent?: CanvasTreeIndent;
}

const ExposureRow = ({
    analysis,
    artifact,
    exposure,
    pluginId,
    isRecentlyReady,
    tourTargetId,
    indent = 'lg',
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene,
    sceneVisualOverrides,
    setSceneOpacity,
    setSceneLineWidth,
    setSceneColor,
    setSceneEdges,
    resolveSceneRenderMetadata
}: ExposureRowProps) => {
    const { download: downloadExposureListing } = useDownloadExposureListing();
    const sceneRenderMetadata = buildSceneRenderMetadata(exposure.export)
        ?? resolveSceneRenderMetadata?.(pluginId, exposure.exposureId);
    const scene = buildPluginScene({
        analysisId: exposure.analysisId,
        exposureId: exposure.exposureId,
        sceneRenderMetadata
    });
    const isActive = isSceneActive(scene);
    const sceneKey = getSceneKey(scene);
    const sceneOverride = sceneVisualOverrides[sceneKey];
    const isLineExposure = sceneRenderMetadata?.exporter === Exporter.LINE;
    const isMeshExposure = sceneRenderMetadata?.exporter === Exporter.MESH;
    const defaultLineWidth = sceneRenderMetadata?.defaultLineWidth ?? DEFAULT_LINE_WIDTH;

    const labelToneClass = {
        pending: '[&>.truncate]:text-warning-soft-foreground',
        generating: '[&>.truncate]:text-info-soft-foreground',
        uploading: '[&>.truncate]:text-info-soft-foreground',
        'ready-recent': '[&>.truncate]:text-success-soft-foreground',
        failed: '[&>.truncate]:text-danger-soft-foreground'
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
            onClick: () => void downloadExposureListing({
                pluginId,
                exposureId: exposure.exposureId,
                analysisId: analysis._id,
                exposureName: exposure.name
            })
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
            enabled
            id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
            options={exposureMenuOptions}
        >
            <CanvasTreeRow
                indent={indent}
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
                onClick={() => onSelectScene(scene, analysis)}
                tourTargetId={tourTargetId}
            />
        </MaybeContextMenu>
    );
};

export default ExposureRow;
