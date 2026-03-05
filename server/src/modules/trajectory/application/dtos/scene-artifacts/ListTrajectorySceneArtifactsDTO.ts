import type { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/SceneArtifact';

export interface ListTrajectorySceneArtifactsInputDTO {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}
