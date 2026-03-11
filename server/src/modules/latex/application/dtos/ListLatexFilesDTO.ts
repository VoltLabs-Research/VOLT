import type { LatexFileDTO } from './LatexFileDTO';

export interface ListLatexFilesInputDTO {
    teamId: string;
    documentId: string;
};

export type ListLatexFilesOutputDTO = LatexFileDTO[];
