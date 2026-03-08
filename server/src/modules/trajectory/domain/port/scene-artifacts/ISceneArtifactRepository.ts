import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export interface ISceneArtifactRepository extends IBaseRepository<SceneArtifact, SceneArtifactProps> {
    upsertByObjectName(objectName: string, data: Partial<SceneArtifactProps>): Promise<SceneArtifact>;
};
