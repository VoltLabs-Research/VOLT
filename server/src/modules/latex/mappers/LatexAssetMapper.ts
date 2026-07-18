import { createLatexAsset } from '@modules/latex/entities/LatexAsset';
import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type LatexAsset from '@modules/latex/entities/LatexAsset';
import type { LatexAssetProps } from '@modules/latex/entities/LatexAsset';
import type { LatexAssetDocument } from '@modules/latex/models/LatexAssetModel';

export default createMongoMapperFromFactory<LatexAsset, LatexAssetProps, LatexAssetDocument>(
    createLatexAsset,
    ['team', 'document', 'createdBy']
);
