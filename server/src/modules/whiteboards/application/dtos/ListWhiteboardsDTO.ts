import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type {
    PaginatedTeamScopedInputDTO,
    TeamScopedPaginatedOutputDTO,
} from '@modules/team/application/dtos/common';

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
};

export type ListWhiteboardsOutputDTO = TeamScopedPaginatedOutputDTO<WhiteboardListItem>;
