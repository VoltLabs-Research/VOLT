import type { LatexFileDTO } from './LatexFileDTO';

export interface UpdateLatexFileInputDTO {
    teamId: string;
    documentId: string;
    fileId: string;
    name?: string;
    path?: string;
    content?: string;
};

export type UpdateLatexFileOutputDTO = LatexFileDTO;
