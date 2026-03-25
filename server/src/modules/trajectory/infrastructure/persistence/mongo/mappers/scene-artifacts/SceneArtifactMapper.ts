import { SceneArtifactDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export default createMongoMapper<SceneArtifact, SceneArtifactProps, SceneArtifactDocument>(SceneArtifact, [
    'trajectory',
    'storageClusterId',
    'analysis',
    'plugin'
]);
