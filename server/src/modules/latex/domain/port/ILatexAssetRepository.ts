import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type LatexAsset from '@modules/latex/domain/entities/LatexAsset';
import type { LatexAssetProps } from '@modules/latex/domain/entities/LatexAsset';

export interface ILatexAssetRepository extends IBaseRepository<LatexAsset, LatexAssetProps> {
    findAllByDocument(documentId: string): Promise<LatexAsset[]>;
    findByDocumentAndAssetId(documentId: string, assetId: string): Promise<LatexAsset | null>;
}
