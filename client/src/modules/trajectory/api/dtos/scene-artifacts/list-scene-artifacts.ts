import type { SceneArtifactSourceType } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';

export interface RenderableExposurePayload {
    pluginId?: string;
    analysisId?: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    };
}

export interface ListSceneArtifactsInputDTO {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    type?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}
