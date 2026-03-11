import type { LatexFileDTO } from './LatexFileDTO';

export interface SetLatexFileEntrypointInputDTO {
    teamId: string;
    documentId: string;
    fileId: string;
};

export type SetLatexFileEntrypointOutputDTO = LatexFileDTO;
