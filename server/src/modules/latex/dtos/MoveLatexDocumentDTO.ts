import type { TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type MoveLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & {
    folderId: string | null;
};

export type MoveLatexDocumentOutputDTO = null;
