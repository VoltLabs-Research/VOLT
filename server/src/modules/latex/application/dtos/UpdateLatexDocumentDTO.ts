import type { LatexDocumentDTO } from './LatexDocumentDTO';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UpdateLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'> & {
    userId?: string;
    title?: string;
};

export type UpdateLatexDocumentOutputDTO = LatexDocumentDTO;
