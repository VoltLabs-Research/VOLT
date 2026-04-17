import type { LatexAssetDTO } from './LatexAssetDTO';
import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UpdateLatexAssetInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'assetId'> & {
    /** New virtual path for the asset, e.g. `"images/fig1.png"`. */
    path: string;
};

export type UpdateLatexAssetOutputDTO = LatexAssetDTO;
