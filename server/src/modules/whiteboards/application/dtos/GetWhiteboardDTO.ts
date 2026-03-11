export interface GetWhiteboardInputDTO {
    teamId: string;
    whiteboardId: string;
};

export interface GetWhiteboardOutputDTO {
    _id: string;
    title: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};
