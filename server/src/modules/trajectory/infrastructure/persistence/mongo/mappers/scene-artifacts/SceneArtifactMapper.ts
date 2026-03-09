import { SceneArtifactDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

class SceneArtifactMapper extends BaseMapper<SceneArtifact, SceneArtifactProps, SceneArtifactDocument> {
    constructor() {
        super(SceneArtifact, [
            'trajectory',
            'teamCluster',
            'analysis',
            'plugin'
        ]);
    }
};

export default new SceneArtifactMapper();
