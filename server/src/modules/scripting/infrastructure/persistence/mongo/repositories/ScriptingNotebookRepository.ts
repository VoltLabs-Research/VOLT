import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';
import scriptingNotebookMapper from '@modules/scripting/infrastructure/persistence/mongo/mappers/ScriptingNotebookMapper';
import ScriptingNotebookModel from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';
import { injectable } from 'tsyringe';
import type { FilterQuery } from 'mongoose';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type {
    IScriptingNotebookRepository,
    ListScriptingNotebookFilters
} from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { ScriptingNotebookDocument } from '@modules/scripting/infrastructure/persistence/mongo/models/ScriptingNotebookModel';

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
            trajectory: trajectoryId
        });
    }

    async findAllByTeam(
        teamId: string,
        options: PaginationOptions,
        filters?: ListScriptingNotebookFilters
    ): Promise<PaginatedResult<ScriptingNotebook>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;
        const query = this.buildTeamQuery(teamId, filters);

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

    private buildTeamQuery(
        teamId: string,
        filters?: ListScriptingNotebookFilters
    ): FilterQuery<ScriptingNotebookDocument> {
        const query: FilterQuery<ScriptingNotebookDocument> = { team: teamId };

        if (filters?.trajectoryId) {
            query.trajectory = filters.trajectoryId;
            return query;
        }

        if (filters?.scope === ScriptingNotebookScope.General) {
            query.$or = [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ];
            return query;
        }

        if (filters?.scope === ScriptingNotebookScope.Trajectory) {
            query.trajectory = {
                $exists: true,
                $ne: null
            };
        }

        return query;
    }

    private async findOneByQuery(query: FilterQuery<ScriptingNotebookDocument>): Promise<ScriptingNotebook | null> {
        const doc = await this.model.findOne(query).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
