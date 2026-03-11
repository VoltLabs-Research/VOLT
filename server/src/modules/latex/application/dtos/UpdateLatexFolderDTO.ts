import type { LatexFolderDTO } from './LatexFolderDTO';

export interface UpdateLatexFolderInputDTO {
    teamId: string;
    folderId: string;
    title: string;
};

export type UpdateLatexFolderOutputDTO = LatexFolderDTO;
