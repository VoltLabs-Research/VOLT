import type { SceneArtifactSourceType } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';

export interface ListTeamSceneArtifactsInputDTO {
    page?: number;
    limit?: number;
    sourceType?: SceneArtifactSourceType;
    type?: SceneArtifactSourceType;
    analysisId?: string;
    timestep?: number;
};
