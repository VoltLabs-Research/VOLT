import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type DeleteWhiteboardInputDTO = TeamUserScopedEntityIdInputDTO<'whiteboardId'>;

export type DeleteWhiteboardOutputDTO = null;
