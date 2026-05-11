import type { Readable } from 'node:stream';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetLatexAssetContentInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & {
    key: string;
};

export interface GetLatexAssetContentOutputDTO {
    stream: Readable;
    contentType?: string;
    contentLength?: number;
    contentEncoding?: string;
}
