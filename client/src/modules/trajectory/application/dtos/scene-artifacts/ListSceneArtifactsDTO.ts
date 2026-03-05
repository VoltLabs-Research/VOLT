import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SceneArtifact, SceneArtifactSourceType } from '@/modules/trajectory/domain/entities/SceneArtifact';

export interface RenderableExposurePayload {
    pluginId: string;
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
    pluginId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}

export type ListSceneArtifactsOutputDTO = PaginatedResponse<SceneArtifact | RenderableExposurePayload>;
