import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type MoveLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & {
    folderId: string | null;
};

export type MoveLatexDocumentOutputDTO = null;
