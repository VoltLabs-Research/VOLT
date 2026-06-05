import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import analysisMapper from '@modules/analysis/infrastructure/persistence/mongo/mappers/AnalysisMapper';
import type { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import AnalysisModel from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import type { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';

interface CompletedFramesAggregationItem {
    _id: string | null;
    count: number;
}

import type { AnalysisRuntimeTarget } from '@modules/analysis/domain/port/IAnalysisRepository';
export type { AnalysisRuntimeTarget };

interface CompletedFramesGroupStage {
    $group: {
        _id: unknown;
        count: {
            $sum: string;
        };
    };
}

interface CompletedFramesMatchStage {
    $match: {
        completedFrames: {
            $gt: number;
        };
    };
}

@Singleton(ANALYSIS_TOKENS.AnalysisRepository)
export default class AnalysisRepository
    extends MongooseBaseRepository<Analysis, AnalysisProps, AnalysisDocument>
    implements IAnalysisRepository {

    async findRuntimeTargetsByTrajectoryId(trajectoryId: string): Promise<AnalysisRuntimeTarget[]> {
        const docs = await this.model.find({ trajectory: trajectoryId })
            .select('_id computeClusterId')
            .lean()
            .exec() as Array<{ _id: mongoose.Types.ObjectId | string; computeClusterId?: string | null }>;

        return docs.map((doc) => ({
            analysisId: String(doc._id),
            computeClusterId: doc.computeClusterId || undefined
        }));
    }

    async getCompletedFramesByCluster(): Promise<Record<string, number>> {
        const pipeline: Array<CompletedFramesMatchStage | CompletedFramesGroupStage> = [
            {
                $match: {
                    completedFrames: {
                        $gt: 0
                    }
                }
            },
            {
                $group: {
                    _id: '$computeClusterId',
                    count: {
                        $sum: '$completedFrames'
                    }
                }
            }
        ];

        const aggregation = await this.model.aggregate<CompletedFramesAggregationItem>(pipeline);

        return aggregation.reduce<Record<string, number>>((counts, item) => {
            counts[item._id || 'main-cluster'] = item.count || 0;
            return counts;
        }, {});
    }

    async findByTeamAndSearch({
        teamId,
        search,
        trajectoryIds = [],
        page = 1,
        limit = 20,
        populate
    }: Parameters<IAnalysisRepository['findByTeamAndSearch']>[0]) {
        const normalizedSearch = search.trim();
        const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSearch, 'i');
        const filter: FilterQuery<AnalysisDocument> = {
            team: teamId,
            $or: [
                { pluginDisplayName: regex },
                ...(trajectoryIds.length > 0 ? [{ trajectory: { $in: trajectoryIds } }] : []),
                ...(mongoose.Types.ObjectId.isValid(normalizedSearch) ? [{ _id: normalizedSearch }] : [])
            ]
        };
        const skip = (page - 1) * limit;

        let query = this.model.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }) as any;
        if (populate) {
            query = query.populate(populate as any);
        }

        const [docs, total] = await Promise.all([
            query.exec(),
            this.model.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc: AnalysisDocument) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    constructor() {
        super(AnalysisModel, analysisMapper);
    }
};
