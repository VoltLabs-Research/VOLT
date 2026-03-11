import type { LatexFolderDTO } from './LatexFolderDTO';

export interface CreateLatexFolderInputDTO {
    teamId: string;
    userId: string;
    title: string;
    parentId?: string | null;
};

export type CreateLatexFolderOutputDTO = LatexFolderDTO;
