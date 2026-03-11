export interface UpdateWhiteboardInputDTO {
    teamId: string;
    whiteboardId: string;
    title?: string;
};

export interface UpdateWhiteboardOutputDTO {
    _id: string;
    title: string;
    updatedAt: Date;
};
