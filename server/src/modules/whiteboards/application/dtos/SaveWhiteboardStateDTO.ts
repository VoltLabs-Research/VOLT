export interface SaveWhiteboardStateInputDTO {
    teamId: string;
    userId?: string;
    whiteboardId: string;
    stateBuffer: Buffer;
};

export type SaveWhiteboardStateOutputDTO = null;
