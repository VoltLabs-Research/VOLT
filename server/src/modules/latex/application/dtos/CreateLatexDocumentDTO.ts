import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface CreateLatexDocumentInputDTO {
    teamId: string;
    userId: string;
    title: string;
    content?: string;
};

export type CreateLatexDocumentOutputDTO = LatexDocumentDTO;
