import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteLatexAssetInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'assetId'>;

export type DeleteLatexAssetOutputDTO = null;
