import type { Readable } from 'node:stream';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetWhiteboardStateInputDTO = TeamScopedEntityIdInputDTO<'whiteboardId'>;

export interface GetWhiteboardStateOutputDTO {
    stream: Readable;
}
