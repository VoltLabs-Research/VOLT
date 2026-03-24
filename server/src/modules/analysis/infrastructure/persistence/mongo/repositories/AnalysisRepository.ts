import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import AnalysisModel from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import analysisMapper from '@modules/analysis/infrastructure/persistence/mongo/mappers/AnalysisMapper';
import mongoose from 'mongoose';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import type { FilterQuery } from 'mongoose';

interface CompletedFramesAggregationItem {
    _id: string | null;
    count: number;
};

interface CompletedFramesGroupStage {
    $group: {
        _id: unknown;
        count: {
            $sum: string;
        };
    };
};

@injectable()
export default class AnalysisRepository
    extends MongooseBaseRepository<Analysis, AnalysisProps, AnalysisDocument>
    implements IAnalysisRepository {

    async getCompletedFramesByCluster(): Promise<Record<string, number>> {
        const pipeline: CompletedFramesGroupStage[] = [
            {
                $group: {
                    _id: {
                        $ifNull: ['$computeClusterId', '$teamCluster']
                    },
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
