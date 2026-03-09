import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { inject, injectable } from 'tsyringe';
import AnalysisModel from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import analysisMapper from '@modules/analysis/infrastructure/persistence/mongo/mappers/AnalysisMapper';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';

interface CompletedFramesAggregationItem {
    _id: string | null;
    count: number;
};

interface CompletedFramesGroupIdentifier {
    $ifNull: [string, string];
};

interface CompletedFramesGroupStage {
    $group: {
        _id: string | CompletedFramesGroupIdentifier;
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
                        $ifNull: ['$teamCluster', '$clusterId']
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

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(AnalysisModel, analysisMapper);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new AnalysisDeletedEvent({
                analysisId: id,
                trajectoryId: result.trajectory?.toString(),
                pluginId: result.plugin?.toString(),
                teamId: result.team?.toString()
            }));
        }

        return !!result;
    }
};
