import { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

class AnalysisMapper extends BaseMapper<Analysis, AnalysisProps, AnalysisDocument> {
    constructor() {
        super(Analysis, [
            'createdBy',
            'trajectory',
            'plugin',
            'teamCluster'
        ]);
    }
};

export default new AnalysisMapper();
