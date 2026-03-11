import type { LatexFolderDTO } from './LatexFolderDTO';

export interface GetLatexFolderInputDTO {
    teamId: string;
    folderId: string;
};

export interface GetLatexFolderOutputDTO extends LatexFolderDTO {};
