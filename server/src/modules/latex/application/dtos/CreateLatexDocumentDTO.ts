import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface CreateLatexDocumentInputDTO {
    teamId: string;
    userId: string;
    title: string;
    folderId?: string | null;
};

export type CreateLatexDocumentOutputDTO = LatexDocumentDTO;
