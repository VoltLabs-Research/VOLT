import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import SceneArtifactMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/scene-artifacts/SceneArtifactMapper';
import SceneArtifactModel, { SceneArtifactDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';

import { injectable } from 'tsyringe';

@injectable()
export default class SceneArtifactRepository
    extends MongooseBaseRepository<SceneArtifact, SceneArtifactProps, SceneArtifactDocument>
    implements ISceneArtifactRepository {

    constructor() {
        super(SceneArtifactModel, SceneArtifactMapper);
    }

    async upsertByObjectName(objectName: string, data: Partial<SceneArtifactProps>): Promise<SceneArtifact> {
        const doc = await this.model.findOneAndUpdate(
            { objectName },
            {
                $set: {
                    ...data,
                    objectName
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        ).exec();

        return this.mapper.toDomain(doc);
    }
};
