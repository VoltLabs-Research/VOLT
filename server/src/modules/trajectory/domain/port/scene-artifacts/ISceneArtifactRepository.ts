import { IBaseRepository, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export interface TeamSceneArtifactFilters {
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
};

export interface ISceneArtifactRepository extends IBaseRepository<SceneArtifact, SceneArtifactProps> {
    upsertByObjectName(objectName: string, data: Partial<SceneArtifactProps>): Promise<SceneArtifact>;
    upsertManyByObjectName(entries: Array<{ objectName: string; data: Partial<SceneArtifactProps> }>): Promise<void>;
    findAllByTeamId(
        teamId: string,
        options: PaginationOptions,
        filters?: TeamSceneArtifactFilters
    ): Promise<PaginatedResult<SceneArtifact>>;
};
