import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { LatexFolderDTO } from './LatexFolderDTO';

export interface ListLatexFoldersInputDTO {
    teamId: string;
    parentId?: string | null;
    page?: number | string;
    limit?: number | string;
};

export type ListLatexFoldersOutputDTO = PaginatedResult<LatexFolderDTO>;
