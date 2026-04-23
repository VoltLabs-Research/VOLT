import ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import scriptingNotebookMapper from '@modules/scripting/infrastructure/persistence/mongo/mappers/ScriptingNotebookMapper';
import ScriptingNotebookModel from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';
import type { FilterQuery } from 'mongoose';

@Singleton()
export default class ScriptingNotebookRepository
    extends MongooseBaseRepository<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument> {

    constructor() {
        super(ScriptingNotebookModel, scriptingNotebookMapper);
    }

    async findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null> {
        return this.findOneByQuery({
            _id: notebookId,
            team: teamId
        });
    }

    async removeTrajectory(trajectoryId: string): Promise<void> {
        const impactedNotebookIds = await this.model.find({
            trajectory: trajectoryId
        }).distinct('_id').exec();

        await this.model.updateMany({
            trajectory: trajectoryId
        }, {
            $set: {
                trajectory: null
            }
        }).exec();

        if (!impactedNotebookIds.length) {
            return;
        }

        await this.model.deleteMany({
            _id: {
                $in: impactedNotebookIds
            },
            $or: [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ]
        }).exec();
    }

    async findAllWithTrajectory(trajectoryId: string): Promise<ScriptingNotebook[]> {
        const docs = await this.model.find({
            trajectory: trajectoryId
        }).exec();
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    private async findOneByQuery(query: FilterQuery<ScriptingNotebookDocument>): Promise<ScriptingNotebook | null> {
        const doc = await this.model.findOne(query).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
