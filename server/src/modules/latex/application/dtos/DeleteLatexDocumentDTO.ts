import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & {
    userId?: string;
};

export type DeleteLatexDocumentOutputDTO = null;
