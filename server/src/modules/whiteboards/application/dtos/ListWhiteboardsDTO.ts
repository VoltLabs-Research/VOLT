import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';

export interface ListWhiteboardsInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    folderId?: string;
};

export interface WhiteboardListItem {
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardProps['lastEditedBy'];
    createdAt: Date;
    updatedAt: Date;
};

export type ListWhiteboardsOutputDTO = PaginatedResult<WhiteboardListItem>;
