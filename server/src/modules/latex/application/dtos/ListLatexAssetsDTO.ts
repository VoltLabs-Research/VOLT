import type { LatexAssetDTO } from './LatexAssetDTO';

export interface ListLatexAssetsInputDTO {
    teamId: string;
    documentId: string;
};

export type ListLatexAssetsOutputDTO = LatexAssetDTO[];
