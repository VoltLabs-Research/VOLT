import type {
    IBaseRepository,
    PaginatedResult,
    PaginationOptions
} from '@shared/domain/port/IBaseRepository';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';

export interface WhiteboardPaginationOptions extends PaginationOptions {
    folderId?: string | null | 'all';
};

export interface IWhiteboardRepository extends IBaseRepository<Whiteboard, WhiteboardProps> {
    findByTeamAndWhiteboardId(teamId: string, whiteboardId: string): Promise<Whiteboard | null>;
    findAllByTeam(teamId: string, options: WhiteboardPaginationOptions): Promise<PaginatedResult<Whiteboard>>;
};
