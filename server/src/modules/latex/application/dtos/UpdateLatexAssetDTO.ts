import type { LatexAssetDTO } from './LatexAssetDTO';

export interface UpdateLatexAssetInputDTO {
    teamId: string;
    documentId: string;
    assetId: string;
    /** New virtual path for the asset, e.g. `"images/fig1.png"`. */
    path: string;
};

export type UpdateLatexAssetOutputDTO = LatexAssetDTO;
