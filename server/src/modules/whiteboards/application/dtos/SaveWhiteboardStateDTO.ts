export interface SaveWhiteboardStateInputDTO {
    teamId: string;
    whiteboardId: string;
    stateBuffer: Buffer;
};

export type SaveWhiteboardStateOutputDTO = null;
