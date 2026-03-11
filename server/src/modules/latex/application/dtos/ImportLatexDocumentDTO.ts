import type { LatexDocumentDTO } from './LatexDocumentDTO';

export interface ImportLatexDocumentInputDTO {
    teamId: string;
    userId: string;
    file: Express.Multer.File;
    folderId?: string | null;
};

export type ImportLatexDocumentOutputDTO = LatexDocumentDTO;
