import type { Readable } from 'node:stream';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type ExportLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export interface ExportLatexDocumentOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
