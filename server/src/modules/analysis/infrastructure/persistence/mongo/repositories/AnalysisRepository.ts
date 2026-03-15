import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import AnalysisModel from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import analysisMapper from '@modules/analysis/infrastructure/persistence/mongo/mappers/AnalysisMapper';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';

interface CompletedFramesAggregationItem {
    _id: string | null;
    count: number;
};

interface CompletedFramesGroupStage {
    $group: {
        _id: string;
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
                    _id: '$teamCluster',
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

    constructor() {
        super(AnalysisModel, analysisMapper);
    }
};
