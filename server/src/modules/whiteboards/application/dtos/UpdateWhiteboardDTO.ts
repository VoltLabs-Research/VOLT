import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type UpdateWhiteboardInputDTO = TeamUserScopedEntityIdInputDTO<'whiteboardId'> & {
    title?: string;
};

export interface UpdateWhiteboardOutputDTO {
    _id: string;
    title: string;
    updatedAt: Date;
}
