import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type CreateWhiteboardInputDTO = TeamUserScopedInputDTO & {
    title: string;
    folderId?: string | null;
};

export interface CreateWhiteboardOutputDTO {
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    createdAt: Date;
    updatedAt: Date;
}
