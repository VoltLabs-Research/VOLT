import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type DeleteLatexAssetInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'assetId'>;

export type DeleteLatexAssetOutputDTO = null;
