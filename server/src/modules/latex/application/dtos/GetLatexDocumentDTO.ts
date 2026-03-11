import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface GetLatexDocumentInputDTO {
    teamId: string;
    documentId: string;
};

export type GetLatexDocumentOutputDTO = LatexDocumentDTO;
