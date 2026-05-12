import type { IExposureExport } from '@/modules/plugin/api/entities/plugin/exposure';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { PluginScene, SceneRenderMetadata } from '@/modules/fractal/api/entities/scene';
import { Exporter } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export const DEFAULT_DISLOCATION_LINE_WIDTH = 0.08;
const RENDERABLE_SCENE_EXPORTERS = new Set<string>([
    Exporter.ATOMISTIC,
    Exporter.MESH,
    Exporter.DISLOCATION
]);

type ExposureExportLike = {
    exporter?: string;
    type?: string;
    options?: Record<string, unknown>;
};

interface ResolveExposureSceneRenderMetadataParams {
    exposureId: string;
    exposureExport: ExposureExportLike | null | undefined;
    plugin?: Plugin;
}

interface BuildPluginSceneParams {
    analysisId: string;
    exposureId: string;
    sceneRenderMetadata?: SceneRenderMetadata;
}

const toFinitePositiveNumber = (value: unknown): number | undefined => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return undefined;
    }

    return parsedValue;
};

export const resolvePluginExposureExport = (
    plugin: Plugin | undefined,
    exposureId: string
): IExposureExport | null => {
    if (!plugin?.exposures?.length) {
        return null;
    }

    const exposure = plugin.exposures.find((candidate) => candidate._id === exposureId);
    return exposure?.export ?? null;
};

export const getExposureLineWidth = (
    exposureExport: Pick<ExposureExportLike, 'options'> | null | undefined
): number | undefined => {
    return toFinitePositiveNumber(exposureExport?.options?.lineWidth);
};

export const buildSceneRenderMetadata = (
    exposureExport: ExposureExportLike | null | undefined
): SceneRenderMetadata | undefined => {
    if (!exposureExport) {
        return undefined;
    }

    const defaultLineWidth = getExposureLineWidth(exposureExport);

    return {
        exporter: exposureExport.exporter,
        exportType: exposureExport.type,
        ...(defaultLineWidth ? { defaultLineWidth } : {})
    };
};

export const isRenderableSceneExporter = (exporter: string | null | undefined): boolean => {
    return typeof exporter === 'string' && RENDERABLE_SCENE_EXPORTERS.has(exporter);
};

export const isRenderableSceneExport = (
    exposureExport: ExposureExportLike | null | undefined
): boolean => {
    return isRenderableSceneExporter(exposureExport?.exporter);
};

export const resolvePluginSceneRenderMetadata = (
    plugin: Plugin | undefined,
    exposureId: string
): SceneRenderMetadata | undefined => {
    return buildSceneRenderMetadata(resolvePluginExposureExport(plugin, exposureId));
};

export const resolveExposureSceneRenderMetadata = ({
    exposureId,
    exposureExport,
    plugin
}: ResolveExposureSceneRenderMetadataParams): SceneRenderMetadata | undefined => {
    return buildSceneRenderMetadata(exposureExport) ?? resolvePluginSceneRenderMetadata(plugin, exposureId);
};

export const buildPluginScene = ({
    analysisId,
    exposureId,
    sceneRenderMetadata
}: BuildPluginSceneParams): PluginScene => {
    return {
        sceneType: exposureId,
        source: 'plugin',
        analysisId,
        exposureId,
        ...(sceneRenderMetadata ? { sceneRenderMetadata } : {})
    };
};
