import { AnalysisDocument } from '@modules/analysis/models/AnalysisModel';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createAnalysis } from '@modules/analysis/entities/Analysis';
import type Analysis from '@modules/analysis/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/entities/Analysis';

export default createMongoMapperFromFactory<Analysis, AnalysisProps, AnalysisDocument>(createAnalysis, [
    'createdBy',
    'trajectory',
    'plugin',
    'computeClusterId',
    'storageClusterId',
    'team'
]);
