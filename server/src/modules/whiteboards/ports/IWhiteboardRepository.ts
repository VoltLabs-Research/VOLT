import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardProps } from '@modules/whiteboards/entities/Whiteboard';
import type Whiteboard from '@modules/whiteboards/entities/Whiteboard';

export interface IWhiteboardRepository extends IBaseRepository<Whiteboard, WhiteboardProps> {
    findByTeamAndWhiteboardId(teamId: string, whiteboardId: string): Promise<Whiteboard | null>;
}
