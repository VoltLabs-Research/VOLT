import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardFolderDTO } from './WhiteboardFolderDTO';

export interface ListWhiteboardFoldersInputDTO {
    teamId: string;
    parentId?: string | null;
    page?: number | string;
    limit?: number | string;
};

export type ListWhiteboardFoldersOutputDTO = PaginatedResult<WhiteboardFolderDTO>;
