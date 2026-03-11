import LatexAsset from '@modules/latex/domain/entities/LatexAsset';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { LatexAssetProps } from '@modules/latex/domain/entities/LatexAsset';
import type { LatexAssetDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexAssetModel';

export default createMongoMapper<LatexAsset, LatexAssetProps, LatexAssetDocument>(
    LatexAsset,
    ['team', 'document', 'createdBy']
);
