import type { TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type MoveWhiteboardInputDTO = TeamScopedEntityIdInputDTO<'whiteboardId'> & {
    folderId: string | null;
};

export type MoveWhiteboardOutputDTO = null;
