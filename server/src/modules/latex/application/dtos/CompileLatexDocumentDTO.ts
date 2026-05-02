import type { Readable } from 'node:stream';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type CompileLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export interface CompileLatexDocumentOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
