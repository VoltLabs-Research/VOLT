import type { IBaseRepository, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';

export interface IWhiteboardFolderRepository extends IBaseRepository<WhiteboardFolder, WhiteboardFolderProps> {
    findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<WhiteboardFolder>>;
    findByTeamAndFolderId(teamId: string, folderId: string): Promise<WhiteboardFolder | null>;
};
