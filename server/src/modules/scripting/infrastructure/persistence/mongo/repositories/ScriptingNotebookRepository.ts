import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import scriptingNotebookMapper from '@modules/scripting/infrastructure/persistence/mongo/mappers/ScriptingNotebookMapper';
import ScriptingNotebookModel from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';
import { injectable } from 'tsyringe';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';

interface ScriptingNotebookQuery {
    _id?: string;
    team: string;
    trajectories?: string;
};

@injectable()
export default class ScriptingNotebookRepository
    extends MongooseBaseRepository<ScriptingNotebook, ScriptingNotebookProps, ScriptingNotebookDocument>
    implements IScriptingNotebookRepository {

    constructor() {
        super(ScriptingNotebookModel, scriptingNotebookMapper);
    }

    async findByTeamAndNotebookId(teamId: string, notebookId: string): Promise<ScriptingNotebook | null> {
        return this.findOneByQuery({
            _id: notebookId,
            team: teamId
        });
    }

    async findByTeamAndTrajectory(teamId: string, trajectoryId: string): Promise<ScriptingNotebook | null> {
        return this.findOneByQuery({
            team: teamId,
            trajectories: trajectoryId
        });
    }

    async findAllByTeam(
        teamId: string,
        options: PaginationOptions,
        trajectoryId?: string
    ): Promise<PaginatedResult<ScriptingNotebook>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;
        const query: ScriptingNotebookQuery = { team: teamId };

        if (trajectoryId) {
            query.trajectories = trajectoryId;
        }

        const [docs, total] = await Promise.all([
            this.model.find(query).skip(skip).limit(limit).sort({ updatedAt: -1 }).exec(),
            this.model.countDocuments(query)
        ]);

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async removeTrajectory(trajectoryId: string): Promise<void> {
        await this.model.updateMany({
            trajectories: trajectoryId
        }, {
            $pull: {
                trajectories: trajectoryId
            }
        });

        await this.model.deleteMany({
            trajectories: {
                $size: 0
            }
        });
    }

    async findAllWithTrajectory(trajectoryId: string): Promise<ScriptingNotebook[]> {
        const docs = await this.model.find({ trajectories: trajectoryId }).exec();
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    private async findOneByQuery(query: ScriptingNotebookQuery): Promise<ScriptingNotebook | null> {
        const doc = await this.model.findOne(query).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
