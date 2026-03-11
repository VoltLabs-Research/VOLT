import type { IBaseRepository, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';

export interface LatexFolderPaginationOptions extends PaginationOptions {
    parentId?: string | null;
};

export interface ILatexFolderRepository extends IBaseRepository<LatexFolder, LatexFolderProps> {
    findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<LatexFolder>>;
    findByTeamAndFolderId(teamId: string, folderId: string): Promise<LatexFolder | null>;
};
