import type { LatexAssetDTO } from './LatexAssetDTO';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type ListLatexAssetsInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export type ListLatexAssetsOutputDTO = LatexAssetDTO[];
