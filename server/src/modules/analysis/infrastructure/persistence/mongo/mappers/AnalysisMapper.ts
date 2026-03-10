import { AnalysisDocument } from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';

export default createMongoMapper<Analysis, AnalysisProps, AnalysisDocument>(Analysis, [
    'createdBy',
    'trajectory',
    'plugin',
    'teamCluster'
]);
