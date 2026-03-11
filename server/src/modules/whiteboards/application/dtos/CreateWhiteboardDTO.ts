export interface CreateWhiteboardInputDTO {
    teamId: string;
    userId: string;
    title: string;
};

export interface CreateWhiteboardOutputDTO {
    _id: string;
    title: string;
    payloadKey: string;
    createdAt: Date;
    updatedAt: Date;
};
