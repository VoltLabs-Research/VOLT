import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetWhiteboardInputDTO = TeamScopedEntityIdInputDTO<'whiteboardId'>;

export interface GetWhiteboardOutputDTO {
    _id: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardProps['lastEditedBy'];
    createdAt: Date;
    updatedAt: Date;
};
