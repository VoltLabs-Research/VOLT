import type { LatexFileDTO } from './LatexFileDTO';
import type { EntityIdInputDTO, TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type UpdateLatexFileInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & EntityIdInputDTO<'fileId'> & {
    name?: string;
    path?: string;
    content?: string;
    /**
     * Write origin. `'ai'` triggers a live broadcast of the new content into any
     * open Yjs editing session; `'editor'` (default when omitted) is a plain
     * persist with no broadcast — used by the HTTP path and socket auto-save,
     * which already deliver their own live updates.
     */
    source?: 'ai' | 'editor';
};

export type UpdateLatexFileOutputDTO = LatexFileDTO;
