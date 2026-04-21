import { createLatexAsset } from '@modules/latex/domain/entities/LatexAsset';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type LatexAsset from '@modules/latex/domain/entities/LatexAsset';
import type { LatexAssetProps } from '@modules/latex/domain/entities/LatexAsset';
import type { LatexAssetDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexAssetModel';

export default createMongoMapperFromFactory<LatexAsset, LatexAssetProps, LatexAssetDocument>(
    createLatexAsset,
    ['team', 'document', 'createdBy']
);
