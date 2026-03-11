import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

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
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type ListWhiteboardsOutputDTO = PaginatedResult<WhiteboardListItem>;
