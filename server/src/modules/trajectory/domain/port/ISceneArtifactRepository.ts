import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/SceneArtifact';

export interface ISceneArtifactRepository extends IBaseRepository<SceneArtifact, SceneArtifactProps> {
    upsertByObjectName(objectName: string, data: Partial<SceneArtifactProps>): Promise<SceneArtifact>;
}
