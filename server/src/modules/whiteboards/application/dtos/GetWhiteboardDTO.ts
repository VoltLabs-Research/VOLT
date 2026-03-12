import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';

export interface GetWhiteboardInputDTO {
    teamId: string;
    whiteboardId: string;
};

export interface GetWhiteboardOutputDTO {
    _id: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardProps['lastEditedBy'];
    createdAt: Date;
    updatedAt: Date;
};
