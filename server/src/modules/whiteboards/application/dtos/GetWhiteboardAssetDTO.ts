import type { Readable } from 'node:stream';
import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetWhiteboardAssetInputDTO = TeamScopedEntityIdInputDTO<'whiteboardId'> & EntityIdInputDTO<'assetId'>;

export interface GetWhiteboardAssetOutputDTO {
    stream: Readable;
    mimetype?: string;
}
