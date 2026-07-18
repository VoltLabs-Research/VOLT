import type { SceneArtifactSourceType } from '@modules/trajectory/entities/scene-artifacts/SceneArtifact';

export interface ListTrajectorySceneArtifactsInputDTO {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
};
