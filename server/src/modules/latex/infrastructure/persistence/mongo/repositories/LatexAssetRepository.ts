import LatexAsset from '@modules/latex/domain/entities/LatexAsset';
import latexAssetMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexAssetMapper';
import LatexAssetModel from '@modules/latex/infrastructure/persistence/mongo/models/LatexAssetModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { LatexAssetProps } from '@modules/latex/domain/entities/LatexAsset';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { LatexAssetDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexAssetModel';

@Singleton()
export default class LatexAssetRepository
    extends MongooseBaseRepository<LatexAsset, LatexAssetProps, LatexAssetDocument>
    implements ILatexAssetRepository {

    constructor() {
        super(LatexAssetModel, latexAssetMapper);
    }

    async findAllByDocument(documentId: string): Promise<LatexAsset[]> {
        const docs = await this.model
            .find({ document: documentId })
            .sort({ createdAt: -1 })
            .exec();
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    async findByDocumentAndAssetId(documentId: string, assetId: string): Promise<LatexAsset | null> {
        const doc = await this.model
            .findOne({ _id: assetId, document: documentId })
            .exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
