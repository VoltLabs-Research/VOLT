import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export interface TeamSceneArtifactOutput {
    _id: string;
    trajectory: SceneArtifactProps['trajectory'];
    teamCluster?: SceneArtifactProps['teamCluster'];
    analysis?: SceneArtifactProps['analysis'];
    plugin?: SceneArtifactProps['plugin'];
    sourceType: SceneArtifactProps['sourceType'];
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactProps['params'];
    displayName: string;
    status: SceneArtifactProps['status'];
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

export interface ListTeamSceneArtifactsInputDTO {
    teamId: string;
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
    page?: number;
    limit?: number;
};

export interface ListTeamSceneArtifactsOutputDTO extends PaginatedResult<TeamSceneArtifactOutput> {};
