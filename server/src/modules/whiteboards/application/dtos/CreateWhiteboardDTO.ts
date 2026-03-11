export interface CreateWhiteboardInputDTO {
    teamId: string;
    userId: string;
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
};
