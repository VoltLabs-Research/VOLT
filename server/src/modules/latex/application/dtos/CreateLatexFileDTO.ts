import type { LatexFileDTO } from './LatexFileDTO';

export interface CreateLatexFileInputDTO {
    teamId: string;
    documentId: string;
    userId: string;
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
};

export type CreateLatexFileOutputDTO = LatexFileDTO;
