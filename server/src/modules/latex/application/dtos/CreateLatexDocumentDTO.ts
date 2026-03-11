import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface CreateLatexDocumentInputDTO {
    teamId: string;
    userId: string;
    title: string;
    content?: string;
    folderId?: string | null;
};

export type CreateLatexDocumentOutputDTO = LatexDocumentDTO;
