// Wire response types for the whiteboards module — the shapes the client reads
// back from `data`. `_id`, refs and dates are strings on the wire.

export interface WhiteboardUserSummary{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export type WhiteboardLastEditedBy = string | WhiteboardUserSummary | null;

/** A whiteboard as the client sees it in list responses. */
export interface WhiteboardListItem{
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardLastEditedBy;
    createdAt: string;
    updatedAt: string;
}

export interface CreateWhiteboardResponse{
    _id: string;
    title: string;
    folder: string | null;
    payloadKey: string;
    createdAt: string;
    updatedAt: string;
}

export interface GetWhiteboardResponse{
    _id: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: WhiteboardLastEditedBy;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateWhiteboardResponse{
    _id: string;
    title: string;
    updatedAt: string;
}

export interface UploadWhiteboardAssetResponse{
    assetId: string;
    uploadUrl: string;
    expiresAt: string;
}

/** A whiteboard catalog folder as the client sees it. */
export interface WhiteboardFolder{
    _id: string;
    title: string;
    parent: string | null;
    createdAt: string;
    updatedAt: string;
}
