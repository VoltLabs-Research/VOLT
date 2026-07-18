import type { WhiteboardProps } from '@modules/whiteboards/entities/Whiteboard';
import type {
    PaginatedTeamScopedInputDTO,
    PaginatedOutputDTO,
} from '@modules/team/dtos/common';

export type ListWhiteboardsInputDTO = PaginatedTeamScopedInputDTO & {
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
}

export type ListWhiteboardsOutputDTO = PaginatedOutputDTO<WhiteboardListItem>;
