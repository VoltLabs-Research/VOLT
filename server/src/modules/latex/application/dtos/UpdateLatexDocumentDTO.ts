import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface UpdateLatexDocumentInputDTO {
    teamId: string;
    documentId: string;
    title?: string;
    content?: string;
};

export type UpdateLatexDocumentOutputDTO = LatexDocumentDTO;
