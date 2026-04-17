import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteWhiteboardInputDTO = TeamUserScopedEntityIdInputDTO<'whiteboardId'>;

export type DeleteWhiteboardOutputDTO = null;
