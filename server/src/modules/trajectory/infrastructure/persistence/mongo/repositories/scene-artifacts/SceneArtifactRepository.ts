import { ISceneArtifactRepository, TeamSceneArtifactFilters } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import SceneArtifact, { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import SceneArtifactMapper from '@modules/trajectory/infrastructure/persistence/mongo/mappers/scene-artifacts/SceneArtifactMapper';
import SceneArtifactModel, { SceneArtifactDocument } from '@modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';
import mongoose from 'mongoose';

import { injectable } from 'tsyringe';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { PipelineStage } from 'mongoose';

interface AggregateIdResult {
    _id: mongoose.Types.ObjectId;
};

interface CountResult {
    total: number;
};

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

    async upsertManyByObjectName(entries: Array<{ objectName: string; data: Partial<SceneArtifactProps> }>): Promise<void> {
        if (!entries.length) {
            return;
        }

        const operations = entries.map((entry) => ({
            updateOne: {
                filter: { objectName: entry.objectName },
                update: {
                    $set: {
                        ...(entry.data as unknown as Partial<SceneArtifactDocument>),
                        objectName: entry.objectName
                    }
                } as mongoose.UpdateQuery<SceneArtifactDocument>,
                upsert: true
            }
        })) as mongoose.AnyBulkWriteOperation<SceneArtifactDocument>[];

        await this.model.bulkWrite(operations, {
            ordered: false
        });
    }

    async findAllByTeamId(
        teamId: string,
        options: PaginationOptions,
        filters?: TeamSceneArtifactFilters
    ): Promise<PaginatedResult<SceneArtifact>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;
        const pipeline = this.buildTeamPipeline(teamId, filters);
        const sortStage: PipelineStage.Sort = {
            $sort: {
                updatedAt: -1,
                _id: -1
            }
        };

        const [idRows, countRows] = await Promise.all([
            this.model.aggregate<AggregateIdResult>([
                ...pipeline,
                sortStage,
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 1 } }
            ]),
            this.model.aggregate<CountResult>([
                ...pipeline,
                { $count: 'total' }
            ])
        ]);

        const ids = idRows.map((row) => row._id);
        if (!ids.length) {
            return {
                data: [],
                total: 0,
                page,
                totalPages: 0,
                limit
            };
        }

        const docs = await this.model.find({
            _id: {
                $in: ids
            }
        }).populate([
            {
                path: 'trajectory',
                select: ['name', 'teamCluster'],
                populate: {
                    path: 'teamCluster',
                    select: ['name']
                }
            },
            {
                path: 'teamCluster',
                select: ['name']
            }
        ]).exec();

        const orderById = new Map(ids.map((id, index) => [id.toString(), index]));
        const sortedDocs = docs.sort((left, right) => {
            return (orderById.get(left._id.toString()) ?? 0) - (orderById.get(right._id.toString()) ?? 0);
        });
        const total = countRows[0]?.total ?? 0;

        return {
            data: sortedDocs.map((doc) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    private buildTeamPipeline(teamId: string, filters?: TeamSceneArtifactFilters): PipelineStage[] {
        const pipeline: PipelineStage[] = [];
        const match: Record<string, unknown> = {};
        if (filters?.sourceType) {
            match.sourceType = filters.sourceType;
        }
        if (filters?.analysisId) {
            match.analysis = new mongoose.Types.ObjectId(filters.analysisId);
        }
        if (filters?.timestep !== undefined) {
            match.timestep = filters.timestep;
        }

        if (Object.keys(match).length > 0) {
            pipeline.push({ $match: match });
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'trajectories',
                    localField: 'trajectory',
                    foreignField: '_id',
                    as: 'trajectoryDoc'
                }
            },
            {
                $unwind: '$trajectoryDoc'
            },
            {
                $match: {
                    'trajectoryDoc.team': new mongoose.Types.ObjectId(teamId)
                }
            }
        );

        return pipeline;
    }
};
