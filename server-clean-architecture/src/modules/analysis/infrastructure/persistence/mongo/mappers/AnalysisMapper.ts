import Analysis, { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class AnalysisMapper extends BaseMapper<Analysis, AnalysisProps, AnalysisDocument>{
    constructor(){
        super(Analysis, [
            'createdBy',
            'trajectory'
        ]);
    }
};

export default new AnalysisMapper();