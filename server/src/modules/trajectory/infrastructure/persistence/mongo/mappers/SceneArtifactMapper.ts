import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/SceneArtifact';
import { SceneArtifactDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/SceneArtifactModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class SceneArtifactMapper extends BaseMapper<SceneArtifact, SceneArtifactProps, SceneArtifactDocument> {
    constructor() {
        super(SceneArtifact, [
            'trajectory',
            'analysis',
            'plugin'
        ]);
    }
}

export default new SceneArtifactMapper();
