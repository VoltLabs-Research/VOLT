import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type SaveWhiteboardStateInputDTO = TeamUserScopedEntityIdInputDTO<'whiteboardId'> & {
    stateBuffer: Buffer;
};

export type SaveWhiteboardStateOutputDTO = null;
