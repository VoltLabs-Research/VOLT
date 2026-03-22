import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface UpdateLatexDocumentInputDTO {
    teamId: string;
    userId?: string;
    documentId: string;
    title?: string;
};

export type UpdateLatexDocumentOutputDTO = LatexDocumentDTO;
